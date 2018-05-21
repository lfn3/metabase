/* @flow */
import React from "react";
import EntityListLoader from "metabase/entities/containers/EntityListLoader";

type Props = {
  writable: boolean, // inherited from old CollectionList component
  children: () => void,
};

const CollectionListLoader = ({ children, writable, ...props }: Props) => (
  <EntityListLoader entityType="collections" {...props}>
    {({ list, collections, ...props }) =>
      children({
        list: writable ? list.filter(c => c.can_write) : list,
        collections: writable
          ? collections.filter(c => c.can_write)
          : collections,
        ...props,
      })
    }
  </EntityListLoader>
);

export default CollectionListLoader;
