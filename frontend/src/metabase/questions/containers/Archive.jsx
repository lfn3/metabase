import React, { Component } from "react";
import { connect } from "react-redux";
import { t } from "c-3po";

import HeaderWithBack from "metabase/components/HeaderWithBack";
import SearchHeader from "metabase/components/SearchHeader";
import ArchivedItem from "../../components/ArchivedItem";

import {
  loadEntities,
  setArchived as setQuestionArchived,
  setSearchText,
} from "../questions";
import { setCollectionArchived } from "../collections";
import { getVisibleEntities, getSearchText } from "../selectors";
import { getUserIsAdmin } from "metabase/selectors/user";

import {
  fetchArchivedDashboards,
  setArchived as setDashboardArchived,
} from "metabase/dashboards/dashboards";
import { getArchivedDashboards } from "metabase/dashboards/selectors";

import visualizations from "metabase/visualizations";

const mapStateToProps = (state, props) => ({
  searchText: getSearchText(state, props),
  archivedCards:
    getVisibleEntities(state, {
      entityType: "cards",
      entityQuery: { f: "archived" },
    }) || [],
  archivedCollections:
    getVisibleEntities(state, {
      entityType: "collections",
      entityQuery: { archived: true },
    }) || [],
  archivedDashboards: getArchivedDashboards(state) || [],

  isAdmin: getUserIsAdmin(state, props),
});

const mapDispatchToProps = {
  loadEntities,
  fetchArchivedDashboards,
  setSearchText,
  setQuestionArchived,
  setCollectionArchived,
  setDashboardArchived,
};

@connect(mapStateToProps, mapDispatchToProps)
export default class Archive extends Component {
  componentWillMount() {
    this.loadEntities();
  }
  loadEntities() {
    this.props.loadEntities("cards", { f: "archived" });
    this.props.loadEntities("collections", { archived: true });
    this.props.fetchArchivedDashboards();
  }
  render() {
    const {
      archivedCards,
      archivedCollections,
      archivedDashboards,
      isAdmin,
    } = this.props;
    console.log("archivedDashboards", archivedDashboards);
    const items = [
      ...archivedCollections.map(collection => ({
        type: "collection",
        ...collection,
      })),
      ...archivedDashboards.map(dashboard => ({
        type: "dashboard",
        ...dashboard,
      })),
      ...archivedCards.map(card => ({ type: "card", ...card })),
    ]; //.sort((a,b) => a.updated_at.valueOf() - b.updated_at.valueOf()))

    return (
      <div className="px4 pt3">
        <div className="flex align-center mb2">
          <HeaderWithBack name={t`Archive`} />
        </div>
        <SearchHeader
          searchText={this.props.searchText}
          setSearchText={this.props.setSearchText}
        />
        <div>
          {items.map(
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
                    this.loadEntities();
                  }}
                />
              ) : item.type === "card" ? (
                <ArchivedItem
                  key={item.type + item.id}
                  name={item.name}
                  type="card"
                  icon={visualizations.get(item.display).iconName}
                  isAdmin={isAdmin}
                  onUnarchive={async () => {
                    await this.props.setQuestionArchived(item.id, false, true);
                    this.loadEntities();
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
                    await this.props.setDashboardArchived(item.id, false, true);
                    this.loadEntities();
                  }}
                />
              ) : null,
          )}
        </div>
      </div>
    );
  }
}
