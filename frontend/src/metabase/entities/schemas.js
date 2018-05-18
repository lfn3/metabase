import { createEntity } from "metabase/lib/entities";

import { GET } from "metabase/lib/api";

const database_schemas = GET("/api/database/:dbId/schemas");

export default createEntity({
  name: "schemas",
  api: {
    list: async params => {
      if (params.dbId) {
        return (await database_schemas(params)).map(schemaName => ({
          // NOTE: needs unqiue IDs for entities to work correctly
          id: params.dbId + ":" + schemaName,
          name: schemaName,
        }));
      } else {
        throw new Error("Schemas can only be listed for a particular dbId");
      }
    },
  },
});
