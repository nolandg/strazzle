import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import SnackbarContent from '@material-ui/core/SnackbarContent';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import { withStyles } from '@material-ui/core/styles';
import Portal from '@material-ui/core/Portal';

const styles = theme => ({
  snackbarMessage: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '1.2em',
    lineHeight: '1.2',
    color: '#FFF !important',
  },
  icon: {
    fontSize: '1.5em',
    marginRight: theme.spacing.unit * 2,
  },
  root_error: {
    backgroundColor: theme.palette.error.main,
  },
  root_success: {
    backgroundColor: theme.palette.success.main,
  },
});

class GenericSnackbar extends Component {
  constructor(props) {
    super(props);
    this.icons = {
      success: <CheckCircleIcon fontSize="inherit" className={props.classes.icon} />,
      error: <ErrorIcon fontSize="inherit" className={props.classes.icon} />,
    };
  }

  handleClose = () => {
    if(this.props.onClose) this.props.onClose();
  }

  render() {
    const { message, classes, autoHideDuration, icon, open, type, action } = this.props;

    return (
      <Portal>
        <Snackbar
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          open={open}
          onClose={this.handleClose}
          autoHideDuration={autoHideDuration}
        >
          <SnackbarContent
            classes={{ root: classes[`root_${type}`], message: classes.snackbarMessage }}
            message={(
              <Fragment>
                {icon === undefined ? this.icons[type] : icon}
                {message}
              </Fragment>
          )}
            headlineMapping={{
              body1: 'div',
              body2: 'div',
            }}
            action={action}
          />
        </Snackbar>
      </Portal>
    );
  }
}
GenericSnackbar.propTypes = {
  message: PropTypes.node.isRequired,
  open: PropTypes.bool.isRequired,
  classes: PropTypes.object.isRequired,
  autoHideDuration: PropTypes.number,
  onClose: PropTypes.func,
  icon: PropTypes.node,
  type: PropTypes.string,
  action: PropTypes.node,
};
GenericSnackbar.defaultProps = {
  autoHideDuration: 3000,
  onClose: null,
  type: 'success',
  icon: undefined,
  action: null,
};

const SnackbarEnhanced = withStyles(styles)(GenericSnackbar);
export { SnackbarEnhanced as Snackbar };
