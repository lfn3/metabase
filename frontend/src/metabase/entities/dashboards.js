/* @flow */

import { createEntity } from "metabase/lib/entities";

const Dashboards = createEntity({
  name: "dashboards",
  path: "/api/dashboard",

  objectActions: {
    setArchived: ({ id }, archived) =>
      Dashboards.actions.update({ id, archived }),
    setCollection: ({ id }, collection) =>
      Dashboards.actions.update({
        id,
        collection_id: collection && collection.id,
      }),
  },

  form: {
    fields: [{ name: "name" }, { name: "description", type: "text" }],
  },
});

export default Dashboards;
