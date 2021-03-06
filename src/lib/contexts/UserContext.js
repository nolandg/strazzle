import React, { Component } from 'react';
import gql from 'graphql-tag';
import { Query } from 'react-apollo';
import PropTypes from 'prop-types';

import { Mutator } from '../components/Mutator';
import buildAnnonUser from '../utils/buildAnnonUser';
import attachUserAuthMethods from '../utils/attachUserAuthMethods';
import currentUserFragment from '../utils/currentUserFragment';

const currentUserQuery = gql`
  ${currentUserFragment}

  query CurrentUser_for_UserContext{
    currentUser {
      ...CurrentUserFragment
    }
    permissions {
      name
      title
      description
      type
      operation
      ownership
    }
  }
`;
Mutator.registerQuery('CurrentUser_for_UserContext');

const UserContext = React.createContext();
const UserContextConsumer = UserContext.Consumer;

class UserContextProvider extends Component {
  render() {
    const { children } = this.props;

    return (
      <Query query={currentUserQuery} errorPolicy="all" notifyOnNetworkStatusChange>
        {({ networkStatus, error, data }) => {
          let user;
          let allPermissions;

          if(data && data.currentUser) {
            user = { ...data.currentUser };
            allPermissions = data.permissions;
          }else{
            user = buildAnnonUser();
            allPermissions = [];
          }
          attachUserAuthMethods(user, allPermissions);

          Object.freeze(user);

          const value = {
            loading: networkStatus !== 7,
            error,
            user,
            allPermissions,
          };

          return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
        }}
      </Query>
    );
  }
}

UserContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { UserContext, UserContextProvider, UserContextConsumer };
