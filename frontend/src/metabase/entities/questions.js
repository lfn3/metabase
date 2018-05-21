/* @flow */

import { createEntity } from "metabase/lib/entities";

const Questions = createEntity({
  name: "questions",
  path: "/api/card",

  objectActions: {
    setArchived: ({ id }, archived) =>
      Questions.actions.update({ id, archived }),
    setCollection: ({ id }, collection) =>
      Questions.actions.update({
        id,
        collection_id: collection && collection.id,
      }),
  },

  form: {
    fields: [{ name: "name" }, { name: "description", type: "text" }],
  },
});

export default Questions;
