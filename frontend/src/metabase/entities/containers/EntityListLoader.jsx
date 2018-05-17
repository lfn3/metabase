/* @flow */

import React from "react";
import { connect } from "react-redux";
import _ from "underscore";

import entityType from "./EntityType";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";

export type Props = {
  entityType?: string,
  loadingAndErrorWrapper: boolean,
  children: (props: RenderProps) => ?React$Element<any>,
};

export type RenderProps = {
  list: ?(any[]),
  loading: boolean,
  error: ?any,
};

@entityType()
@connect((state, { entityDef, query }) => ({
  list: entityDef.selectors.getList(state, { query }),
  loading: entityDef.selectors.getLoading(state, { query }),
  error: entityDef.selectors.getError(state, { query }),
}))
export default class EntitiesListLoader extends React.Component {
  props: Props;

  static defaultProps = {
    loadingAndErrorWrapper: true,
    query: null,
    reload: false,
  };

  componentWillMount() {
    // $FlowFixMe: provided by @connect
    this.props.fetchList(this.props.query, this.props.reload);
  }

  componentWillReceiveProps(nextProps: Props) {
    if (!_.isEqual(nextProps.query, this.props.query)) {
      nextProps.fetchList(nextProps.query, nextProps.reload);
    }
  }

  reload = () => {
    this.props.fetchList(this.props.query, true);
  };

  renderChildren = () => {
    // $FlowFixMe: provided by @connect
    const { children, list, loading, error } = this.props;
    return children({ list, loading, error, reload: this.reload });
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
