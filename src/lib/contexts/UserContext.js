import React, { Component } from 'react';
import gql from 'graphql-tag';
import { Query } from 'react-apollo';
import _ from 'lodash';
import PropTypes from 'prop-types';

import { Mutator } from '../components/Mutator';
import currentUserFragment from '../utils/currentUserFragment';
import attachUserAuthMethods from '../utils/attachUserAuthMethods';

const currentUserQuery = gql`
  ${currentUserFragment}

  query CurrentUser_for_UserContext{
    currentUser {
      ...CurrentUserFragment
    }
  }
`;
Mutator.registerQuery('CurrentUser_for_UserContext');

const UserContext = React.createContext();

class UserContextProvider extends Component {
  render() {
    const { children } = this.props;

    return (
      <Query query={currentUserQuery} errorPolicy="all" notifyOnNetworkStatusChange>
        {({ networkStatus, error, data }) => {
          let user;

          if(data && data.currentUser) {
            user = { ...data.currentUser };
            attachUserAuthMethods(user);
          }else{
            user = {
              isAuthenticated: false,
              isAnnon: true,
              canDo: () => false,
              hasPerm: () => false,
              hasRole: () => false,
              canDoOnAny: () => false,
              canDoOnOwn: () => false,
              isOwner: () => false,
            };
          }

          Object.freeze(user);

          const value = {
            loading: networkStatus !== 7,
            error,
            user,
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


export { UserContext, UserContextProvider };
