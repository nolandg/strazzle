import React, { Component } from 'react';
import { graphql, compose } from 'react-apollo';
import gql from 'graphql-tag';
import PropTypes from 'prop-types';
import _ from 'lodash';
import qatch from 'await-to-js';
// import pluralize from 'pluralize';
import gqlError from '../utils/gqlError';
import queryManager from '../utils/queryManager';

// const pascalToCamel = string => string.replace(/\w/, c => c.toLowerCase());
const camelToPascal = string => string.replace(/\w/, c => c.toUpperCase());

const generateMutation = (operation, collection, fragmentName = 'default') => {
  const pascalType = camelToPascal(collection.type);
  const pascalOperation = camelToPascal(operation);
  // const camelType = pascalToCamel(pascalType);
  // const pluralCamelType = pluralize.plural(camelType);
  // const pluralPascalType = pluralize.plural(pascalType);

  const data = operation !== 'delete'
    ? `$data: ${pascalType}${pascalOperation}Input!`
    : '';
  const where = operation !== 'create'
    ? `$where: ${pascalType}WhereUniqueInput!`
    : '';

  let fragment = collection.fragments[fragmentName];
  let fragmentDefinitionName = fragment.definitions[0].name.value;

  if(operation === 'delete') {
    fragmentDefinitionName = `Delete${pascalType}AutoGeneratedFragment`;
    fragment = gql`
      fragment ${fragmentDefinitionName} on ${pascalType}{
        id
      }
    `;
  }

  const mutation = gql`
    ${fragment}

    mutation ${operation}${pascalType}(
      ${data}
      ${where}
    ){
      ${operation}${pascalType}(${data ? 'data: $data' : ''}, ${where ? 'where: $where' : ''}) {
        ...${fragmentDefinitionName}
      },
    }
  `;

  return mutation;
};


function withMutation(collection, fragmentName, graphqlOptions) {
  return function withMutationInner(WrappedComponent) {
    // Example field:
    //   {
    //     name: 'title',
    //     value: 'My Title',
    //     error: 'Too short',
    //   }
    const getInitialFields = (props) => {
      const { document } = props;
      const { schema } = collection;
      const fields = {};

      Object.keys(schema.fields).forEach((fieldName) => {
        const schemaField = schema.fields[fieldName];

        // Firs try to get initial value from document
        let value = document ? document[fieldName] : undefined;
        if(value === undefined) {
          // No document available or this field isn't in the document
          // Get a default value from schema
          value = schemaField.default();
        }

        fields[fieldName] = {
          name: fieldName,
          value,
          error: null,
        };
      });

      return fields;
    };

    class withMutationClass extends Component {
      callbacks = {
        onMutationSuccess: null,
        onMutationError: null,
      }

      constructor(props) {
        super(props);
        this.state = this.getInitialState(props);
      }

      getInitialState = props => ({
        fields: getInitialFields(props),
        globalErrors: [],
        firstSaveAttempted: false,
      })

      componentDidUpdate = (prevProps) => {
        if(!_.isEqual(prevProps.document, this.props.document)) {
          this.setState(this.getInitialState(this.props));
        }
      }

      isNew = () => {
        const { document } = this.props;
        if(document && (document.id || document.id)) return false;
        return true;
      }

      getFields = () => {
        const fields = [];
        Object.keys(this.state.fields).forEach((name) => {
          const field = this.state.fields[name];
          fields.push(field);
        });
        return fields;
      }

      setFieldValue = (name, value, cb) => {
        this.setState((state) => {
          _.set(state.fields, `${name}.value`, value);
          _.set(state.fields, `${name}.name`, name);
          return state;
        }, cb);
      }

      setFieldError = (name, error, cb) => {
        this.setState((state) => {
          if(name) {
            _.set(state.fields, `${name}.error`, error);
            _.set(state.fields, `${name}.name`, name);
          }else{
            state.globalErrors.push(error);
          }
          return state;
        }, cb);
      }

      setGlobalError = (error, cb) => {
        this.setState((state) => {
          state.globalErrors.push(error);
          return state;
        }, cb);
      }

      handleFieldValueChange = (e, name, value) => {
        this.setFieldValue(name, value, () => {
          if(this.state.firstSaveAttempted) this.recheckForErrors();
        });
      }

      recheckForErrors = () => {
        this.clearErrors();
        const doc = this.assembleDocument();
        this.validateDoc(doc);
      }

      validateDoc = async (doc, setErrors = true) => {
        const { schema } = collection;
        const [error, castDoc] = await qatch(schema.validate(doc, { abortEarly: false }));

        if(error) {
          if(setErrors) {
            error.inner.forEach(({ message, path }) => {
              this.setFieldError(path, message);
            });
          }
          return false;
        }

        return castDoc;
      }

      assembleDocument = () => {
        const doc = {};
        this.getFields().forEach((field) => {
          _.set(doc, field.name, field.value);
        });

        return doc;
      }

      clearErrors = () => {
        this.getFields().forEach((field) => {
          this.setFieldError(field.name, null);
        });
        this.setState({ globalErrors: [] });
      }

      extractErrorsFromFields = () => {
        const errors = [];
        this.getFields().forEach((field) => {
          if(field.error) errors.push(field.error);
        });
        return errors;
      }

      saveDoc = async () => {
        this.setState({ firstSaveAttempted: true });
        this.clearErrors();

        const doc = this.assembleDocument();
        const castDoc = await this.validateDoc(doc);
        if(!castDoc) {
          return;
        }

        this.mutate(castDoc, this.isNew() ? 'create' : 'update');
      }

      deleteDoc = async () => {
        this.clearErrors();
        const id = _.get(this.props, 'document.id');
        if(!id) throw Error('Cannot delete a document without id.');
        this.mutate({ id }, 'delete');
      }

      handleMutationSuccess = (doc) => {
        console.log('Mutation successful');
        queryManager.refetchQueries();
        if(this.callbacks.onMutationSuccess) this.callbacks.onMutationSuccess(doc);
      }

      handleMutationError = (error) => {
        console.error('Mutation Error: ', error);

        error = gqlError(error);
        this.setGlobalError(error.message);

        if(this.callbacks.onMutationError) this.callbacks.onMutationError(error);
      }

      mutate = (doc, operation) => {
        const isNew = this.isNew();
        if((operation !== 'create') && isNew) throw new Error(`Cannot "${operation}" on new document.`);
        if((operation === 'create') && !isNew) throw new Error('Cannot create a non-new document.');

        const data = { ...doc, id: undefined };
        const mutateFunc = this.props[`${operation}Mutation`];
        const pascalType = camelToPascal(collection.type);

        mutateFunc({
          variables: {
            data: operation !== 'delete' ? data : undefined,
            where: { id: doc.id },
          },
        })
          .then((response) => {
            const returnedDoc = response.data[`${operation}${pascalType}`];
            this.handleMutationSuccess(returnedDoc);
          })
          .catch((error) => {
            this.handleMutationError(error);
          });
      }

      registerCallbacks = (callbacks) => {
        this.callbacks = { ...this.callbacks, ...callbacks };
      }

      render() {
        const { ...rest } = this.props;
        const errors = this.extractErrorsFromFields();
        const { globalErrors } = this.state;
        const fieldProps = {
          onChange: this.handleFieldValueChange,
          fields: this.state.fields,
        };

        return (
          <WrappedComponent
            saveDoc={this.saveDoc}
            deleteDoc={this.deleteDoc}
            fieldProps={fieldProps}
            errors={errors}
            globalErrors={globalErrors}
            registerCallbacks={this.registerCallbacks}
            {...rest}
          />
        );
      }
    }
    withMutationClass.propTypes = {
      document: PropTypes.object,
      createMutation: PropTypes.func.isRequired,
      updateMutation: PropTypes.func.isRequired,
      deleteMutation: PropTypes.func.isRequired,
    };
    withMutationClass.defaultProps = {
      document: undefined,
    };

    const defaultOptions = {
      errorPolicy: 'none',
    };
    const options = { ...defaultOptions, ...graphqlOptions };
    const config = {
      options,
    };

    const createMutation = generateMutation('create', collection, fragmentName);
    const updateMutation = generateMutation('update', collection, fragmentName);
    const deleteMutation = generateMutation('delete', collection, fragmentName);

    return compose(
      graphql(createMutation, { ...config, name: 'createMutation' }),
      graphql(updateMutation, { ...config, name: 'updateMutation' }),
      graphql(deleteMutation, { ...config, name: 'deleteMutation' }),
    )(withMutationClass);
  };
}


export { withMutation };
