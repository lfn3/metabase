import React, { Component } from "react";
import { connect } from "react-redux";
import { t } from "c-3po";

import HeaderWithBack from "metabase/components/HeaderWithBack";
import SearchHeader from "metabase/components/SearchHeader";
import ArchivedItem from "../../components/ArchivedItem";

import EntityListLoader from "metabase/entities/containers/EntityListLoader";

import {
  setArchived as setQuestionArchived,
  setSearchText,
} from "../questions";
import { setCollectionArchived } from "../collections";
import { getSearchText } from "../selectors";
import { getUserIsAdmin } from "metabase/selectors/user";

import { setArchived as setDashboardArchived } from "metabase/dashboards/dashboards";

import visualizations from "metabase/visualizations";

const mapStateToProps = (state, props) => ({
  searchText: getSearchText(state, props),
  isAdmin: getUserIsAdmin(state, props),
});

const mapDispatchToProps = {
  setSearchText,
  setQuestionArchived,
  setCollectionArchived,
  setDashboardArchived,
};

@connect(mapStateToProps, mapDispatchToProps)
export default class Archive extends Component {
  render() {
    const { isAdmin } = this.props;
    return (
      <div className="px4 pt3">
        <div className="flex align-center mb2">
          <HeaderWithBack name={t`Archive`} />
        </div>
        <SearchHeader
          searchText={this.props.searchText}
          setSearchText={this.props.setSearchText}
        />
        <EntityListLoader entityType="search" entityQuery={{ archived: true }}>
          {({ list, reload }) =>
            list.filter(item => true).map(
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
                      await this.props.setCollectionArchived(item.id, false);
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
                      console.log("unarchive");
                      await this.props.setQuestionArchived(
                        item.id,
                        false,
                        true,
                      );
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
                      await this.props.setDashboardArchived(
                        item.id,
                        false,
                        true,
                      );
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
            )
          }
        </EntityListLoader>
      </div>
    );
  }
}
