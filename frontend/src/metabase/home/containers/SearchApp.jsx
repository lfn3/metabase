import React from "react";

import EntityListLoader from "metabase/entities/containers/EntityListLoader";

export default class SearchApp extends React.Component {
  render() {
    return (
      <EntityListLoader entityType="search" query={this.props.location.query}>
        {({ list }) => (
          <div>
            {list.map(item => (
              <div>
                {item.type}: {item.name} ({item.id})
              </div>
            ))}
          </div>
        )}
      </EntityListLoader>
    );
  }
}
