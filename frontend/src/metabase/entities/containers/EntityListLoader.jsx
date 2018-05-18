/* @flow */

import React from "react";
import { connect } from "react-redux";
import _ from "underscore";

import entityType from "./EntityType";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";

export type Props = {
  entityType?: string,
  entityQuery?: ?{ [key: string]: any },
  reload?: boolean,
  loadingAndErrorWrapper: boolean,
  children: (props: RenderProps) => ?React$Element<any>,
};

export type RenderProps = {
  list: ?(any[]),
  loading: boolean,
  error: ?any,
  reload: () => void,
};

@entityType()
@connect((state, { entityDef, entityQuery }) => ({
  list: entityDef.selectors.getList(state, { entityQuery }),
  loading: entityDef.selectors.getLoading(state, { entityQuery }),
  error: entityDef.selectors.getError(state, { entityQuery }),
}))
export default class EntitiesListLoader extends React.Component {
  props: Props;

  static defaultProps = {
    loadingAndErrorWrapper: true,
    entityQuery: null,
    reload: false,
  };

  componentWillMount() {
    // $FlowFixMe: provided by @connect
    this.props.fetchList(this.props.entityQuery, this.props.reload);
  }

  componentWillReceiveProps(nextProps: Props) {
    if (!_.isEqual(nextProps.entityQuery, this.props.entityQuery)) {
      // $FlowFixMe: provided by @connect
      nextProps.fetchList(nextProps.entityQuery, nextProps.reload);
    }
  }

  reload = () => {
    // $FlowFixMe: provided by @connect
    this.props.fetchList(this.props.entityQuery, true);
  };

  renderChildren = () => {
    // $FlowFixMe: provided by @connect
    const { children, list, loading, error, entityDef } = this.props;
    return children({
      // alias the entities name:
      [entityDef.name]: list,
      list,
      loading,
      error,
      reload: this.reload,
    });
  };

  render() {
    // $FlowFixMe: provided by @connect
    const { loading, error, loadingAndErrorWrapper } = this.props;
    return loadingAndErrorWrapper ? (
      <LoadingAndErrorWrapper
        loading={loading}
        error={error}
        children={this.renderChildren}
      />
    ) : (
      this.renderChildren()
    );
  }
}
