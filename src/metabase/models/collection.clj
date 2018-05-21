(ns metabase.models.collection
  (:require [clojure
             [data :as data]
             [string :as str]]
            [metabase.api.common :refer [*current-user-id* *current-user-permissions-set*] :as api]
            [metabase.models
             [collection-revision :as collection-revision :refer [CollectionRevision]]
             [interface :as i]
             [permissions :as perms]]
            [metabase.util :as u]
            [metabase.util.schema :as su]
            [puppetlabs.i18n.core :refer [tru]]
            [schema.core :as s]
            [toucan
             [db :as db]
             [models :as models]]))

(def ^:private ^:const collection-slug-max-length
  "Maximum number of characters allowed in a Collection `slug`."
  254)

(models/defmodel Collection :collection)

(defn- assert-unique-slug [slug]
  (when (db/exists? Collection :slug slug)
    (throw (ex-info (tru "Name already taken")
             {:status-code 400, :errors {:name (tru "A collection with this name already exists")}}))))

(def ^:const ^java.util.regex.Pattern hex-color-regex
  "Regex for a valid value of `:color`, a 7-character hex string including the preceding hash sign."
  #"^#[0-9A-Fa-f]{6}$")

(defn- assert-valid-hex-color [^String hex-color]
  (when (or (not (string? hex-color))
            (not (re-matches hex-color-regex hex-color)))
    (throw (ex-info (tru "Invalid color")
             {:status-code 400, :errors {:color (tru "must be a valid 6-character hex color code")}}))))

(defn- slugify [collection-name]
  ;; double-check that someone isn't trying to use a blank string as the collection name
  (when (str/blank? collection-name)
    (throw (ex-info (tru "Collection name cannot be blank!")
             {:status-code 400, :errors {:name (tru "cannot be blank")}})))
  (u/slugify collection-name collection-slug-max-length))

(defn- pre-insert [{collection-name :name, color :color, :as collection}]
  (assert-valid-hex-color color)
  (assoc collection :slug (u/prog1 (slugify collection-name)
                            (assert-unique-slug <>))))

(defn- pre-update [{collection-name :name, id :id, color :color, archived? :archived, :as collection}]
  ;; make sure hex color is valid
  (when (contains? collection :color)
    (assert-valid-hex-color color))
  ;; archive / unarchive cards in this collection as needed
  (db/update-where! 'Card {:collection_id id}
    :archived archived?)
  ;; slugify the collection name and make sure it's unique
  (if-not collection-name
    collection
    (assoc collection :slug (u/prog1 (slugify collection-name)
                              ;; if slug hasn't changed no need to check for uniqueness otherwise check to make sure
                              ;; the new slug is unique
                              (or (db/exists? Collection, :slug <>, :id id)
                                  (assert-unique-slug <>))))))

(defn- pre-delete [collection]
  ;; unset the collection_id for Cards/Pulses in this collection. This is mostly for the sake of tests since IRL we
  ;; shouldn't be deleting Collections, but rather archiving them instead
  (doseq [model ['Card 'Pulse 'Dashboard]]
    (db/update-where! model {:collection_id (u/get-id collection)}
      :collection_id nil)))

(defn perms-objects-set
  "Return the required set of permissions to READ-OR-WRITE COLLECTION-OR-ID."
  [collection-or-id read-or-write]
  ;; This is not entirely accurate as you need to be a superuser to modifiy a collection itself (e.g., changing its
  ;; name) but if you have write perms you can add/remove cards
  #{(case read-or-write
      :read  (perms/collection-read-path collection-or-id)
      :write (perms/collection-readwrite-path collection-or-id))})


(u/strict-extend (class Collection)
  models/IModel
  (merge models/IModelDefaults
         {:hydration-keys (constantly [:collection])
          :types          (constantly {:name :clob, :description :clob})
          :pre-insert     pre-insert
          :pre-update     pre-update
          :pre-delete     pre-delete})
  i/IObjectPermissions
  (merge i/IObjectPermissionsDefaults
         {:can-read?         (partial i/current-user-has-full-permissions? :read)
          :can-write?        (partial i/current-user-has-full-permissions? :write)
          :perms-objects-set perms-objects-set}))


;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                               PERMISSIONS GRAPH                                                |
;;; +----------------------------------------------------------------------------------------------------------------+

;;; ---------------------------------------------------- Schemas -----------------------------------------------------

(def ^:private CollectionPermissions
  (s/enum :write :read :none))

(def ^:private GroupPermissionsGraph
  "collection-id -> status"
  {su/IntGreaterThanZero CollectionPermissions})

(def ^:private PermissionsGraph
  {:revision s/Int
   :groups   {su/IntGreaterThanZero GroupPermissionsGraph}})


;;; -------------------------------------------------- Fetch Graph ---------------------------------------------------

(defn- group-id->permissions-set []
  (into {} (for [[group-id perms] (group-by :group_id (db/select 'Permissions))]
             {group-id (set (map :object perms))})))

(s/defn ^:private perms-type-for-collection :- CollectionPermissions
  [permissions-set collection-id]
  (cond
    (perms/set-has-full-permissions? permissions-set (perms/collection-readwrite-path collection-id)) :write
    (perms/set-has-full-permissions? permissions-set (perms/collection-read-path collection-id))      :read
    :else                                                                                             :none))

(s/defn ^:private group-permissions-graph :- GroupPermissionsGraph
  "Return the permissions graph for a single group having PERMISSIONS-SET."
  [permissions-set collection-ids]
  (into {} (for [collection-id collection-ids]
             {collection-id (perms-type-for-collection permissions-set collection-id)})))

(s/defn graph :- PermissionsGraph
  "Fetch a graph representing the current permissions status for every group and all permissioned collections. This
  works just like the function of the same name in `metabase.models.permissions`; see also the documentation for that
  function."
  []
  (let [group-id->perms (group-id->permissions-set)
        collection-ids  (db/select-ids 'Collection)]
    {:revision (collection-revision/latest-id)
     :groups   (into {} (for [group-id (db/select-ids 'PermissionsGroup)]
                          {group-id (group-permissions-graph (group-id->perms group-id) collection-ids)}))}))


;;; -------------------------------------------------- Update Graph --------------------------------------------------

(s/defn ^:private update-collection-permissions!
  [group-id :- su/IntGreaterThanZero, collection-id :- su/IntGreaterThanZero, new-collection-perms :- CollectionPermissions]
  ;; remove whatever entry is already there (if any) and add a new entry if applicable
  (perms/revoke-collection-permissions! group-id collection-id)
  (case new-collection-perms
    :write (perms/grant-collection-readwrite-permissions! group-id collection-id)
    :read  (perms/grant-collection-read-permissions! group-id collection-id)
    :none  nil))

(s/defn ^:private update-group-permissions! [group-id :- su/IntGreaterThanZero, new-group-perms :- GroupPermissionsGraph]
  (doseq [[collection-id new-perms] new-group-perms]
    (update-collection-permissions! group-id collection-id new-perms)))

(defn- save-perms-revision!
  "Save changes made to the collection permissions graph for logging/auditing purposes.
   This doesn't do anything if `*current-user-id*` is unset (e.g. for testing or REPL usage)."
  [current-revision old new]
  (when *current-user-id*
    ;; manually specify ID here so if one was somehow inserted in the meantime in the fraction of a second since we
    ;; called `check-revision-numbers` the PK constraint will fail and the transaction will abort
    (db/insert! CollectionRevision
      :id     (inc current-revision)
      :before  old
      :after   new
      :user_id *current-user-id*)))

(s/defn update-graph!
  "Update the collections permissions graph. This works just like the function of the same name in
  `metabase.models.permissions`, but for `Collections`; refer to that function's extensive documentation to get a
  sense for how this works."
  ([new-graph :- PermissionsGraph]
   (let [old-graph (graph)
         [old new] (data/diff (:groups old-graph) (:groups new-graph))]
     (perms/log-permissions-changes old new)
     (perms/check-revision-numbers old-graph new-graph)
     (when (seq new)
       (db/transaction
         (doseq [[group-id changes] new]
           (update-group-permissions! group-id changes))
         (save-perms-revision! (:revision old-graph) old new)))))
  ;; The following arity is provided soley for convenience for tests/REPL usage
  ([ks new-value]
   {:pre [(sequential? ks)]}
   (update-graph! (assoc-in (graph) (cons :groups ks) new-value))))


;;; ------------------------------------------- Perms Checking Helper Fns --------------------------------------------

(defn check-write-perms-for-collection
  "Check that we have write permissions for Collection with `collection-id`, or throw a 403 Exception. If
  `collection-id` is `nil`, this check is skipped."
  [collection-or-id]
  (when collection-or-id
    (api/check-403 (perms/set-has-full-permissions? @*current-user-permissions-set*
                     (perms/collection-readwrite-path collection-or-id)))))

(defn check-allowed-to-change-collection
  "If we're changing the `collection_id` of an `object`, make sure we have write permissions for the new Collection, and
  throw a 403 if not. If `collection-id` is `nil`, or hasn't changed from the original `object`, this check does
  nothing."
  [object collection-or-id]
  ;; TODO - what about when someone wants to *unset* the Collection? We should tweak this check to handle that case as
  ;; well
  (when (and collection-or-id
             (not= (u/get-id collection-or-id) (:collection_id object)))
    (check-write-perms-for-collection collection-or-id)))

(defn check-allowed-to-change-position-in-collection
  "If we're changing the `collection_position` of an object, make sure that we have permissions to make the change, or
  throw a 403."
  [object-before-update object-updates]
  ;; If collection_position was specified in the API request `body`, that means we want to change it
  (when (contains? object-updates :collection_position)
    (let [orig-position     (:collection_position object-before-update)
          new-position      (:collection_position object-updates)
          new-collection-id (if (contains? object-updates :collection_id)
                              (:collection_id object-updates)
                              (:collection_id object-before-update))]
      ;; check to make sure its position is actually going to be changed before doing any further checks
      (when (not= orig-position new-position)
        ;; ok, make sure we have permissions to edit the Collection this object is going to be in before changing the
        ;; position
        ;;
        ;; TODO - there's nothing to do here for objects in the Root Collection until the Root Collections Perms
        ;; branch gets merged. Once that happens, we will need to add in the appropriate perms checks here !
        (check-write-perms-for-collection new-collection-id)))))
