import { createEntity } from "metabase/lib/entities";

import { schema } from "normalizr";

import {
  QuestionSchema,
  DashboardSchema,
  PulseSchema,
  CollectionSchema,
} from "metabase/schema";
import {
  CardApi,
  DashboardApi,
  PulseApi,
  CollectionsApi,
} from "metabase/services";

import { dissoc } from "icepick";

function createPropertyFilter(property, text) {
  text = String(text || "").toLowerCase();
  if (text) {
    return objects =>
      objects.filter(
        o =>
          String(o[property] || "")
            .toLowerCase()
            .indexOf(text) >= 0,
      );
  }
}

function translateParams(params) {
  params = { ...params };
  if (params.archived) {
    delete params.archived;
    params.f = "archived";
  }
  return params;
}

export default createEntity({
  name: "search",
  api: {
    list: params => {
      return Promise.all([
        CardApi.list(translateParams(params)),
        DashboardApi.list(translateParams(params)).then(
          createPropertyFilter("name", params.q),
        ),
        PulseApi.list(params).then(createPropertyFilter("name", params.q)),
        CollectionsApi.list(params).then(
          createPropertyFilter("name", params.q),
        ),
      ]).then(([questions, dashboards, pulses, collections]) => {
        return [
          ...questions.map(o => ({ ...o, type: "question" })),
          ...dashboards.map(o => ({ ...o, type: "dashboard" })),
          ...pulses.map(o => ({ ...o, type: "pulse" })),
          ...collections.map(o => ({ ...o, type: "collection" })),
        ];
      });
    },
  },
  listSchema: new schema.Array(
    {
      questions: QuestionSchema,
      dashboards: DashboardSchema,
      pulses: PulseSchema,
      collections: CollectionSchema,
    },
    (input, parent, key) => `${input.type}s`,
  ),
});
