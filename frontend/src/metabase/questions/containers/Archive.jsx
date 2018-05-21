import React, { Component } from "react";
import { connect } from "react-redux";
import { t } from "c-3po";

import HeaderWithBack from "metabase/components/HeaderWithBack";
import SearchHeader from "metabase/components/SearchHeader";
import ArchivedItem from "../../components/ArchivedItem";

import { entityListLoader } from "metabase/entities/containers/EntityListLoader";
import listSearch from "metabase/hoc/ListSearch";

import { getUserIsAdmin } from "metabase/selectors/user";

import Questions from "metabase/entities/questions";
import Collections from "metabase/entities/collections";
import Dashboards from "metabase/entities/dashboards";

import visualizations from "metabase/visualizations";

const mapStateToProps = (state, props) => ({
  isAdmin: getUserIsAdmin(state, props),
});

const mapDispatchToProps = {
  setQuestionArchived: Questions.actions.setArchived,
  setCollectionArchived: Collections.actions.setArchived,
  setDashboardArchived: Dashboards.actions.setArchived,
};

@entityListLoader({
  entityType: "search",
  entityQuery: { archived: true },
  reload: true,
})
@listSearch()
@connect(mapStateToProps, mapDispatchToProps)
export default class Archive extends Component {
  render() {
    const { isAdmin, list, reload, searchText, onSetSearchText } = this.props;
    return (
      <div className="px4 pt3">
        <div className="flex align-center mb2">
          <HeaderWithBack name={t`Archive`} />
        </div>
        <SearchHeader searchText={searchText} setSearchText={onSetSearchText} />
        {list.map(
          item =>
            item.type === "collection" ? (
              <ArchivedItem
                key={item.type + item.id}
                name={item.name}
                type="collection"
                icon="collection"
                color={item.color}
                isAdmin={isAdmin}
                onUnarchive={async () => {
                  await this.props.setCollectionArchived(item, false);
                  reload();
                }}
              />
            ) : item.type === "question" ? (
              <ArchivedItem
                key={item.type + item.id}
                name={item.name}
                type="question"
                icon={visualizations.get(item.display).iconName}
                isAdmin={isAdmin}
                onUnarchive={async () => {
                  await this.props.setQuestionArchived(item, false);
                  reload();
                }}
              />
            ) : item.type === "dashboard" ? (
              <ArchivedItem
                key={item.type + item.id}
                name={item.name}
                type="dashboard"
                icon="dashboard"
                isAdmin={isAdmin}
                onUnarchive={async () => {
                  await this.props.setDashboardArchived(item, false);
                  reload();
                }}
              />
            ) : (
              <ArchivedItem
                key={item.type + item.id}
                name={item.name}
                type="unknown"
                icon="unknown"
              />
            ),
        )}
      </div>
    );
  }
}
