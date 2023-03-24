// Handles the lifecycle "uninstalled" event of a connect addon.

const urls = require("url");
const jwt = require("atlassian-jwt");
const _ = require("lodash");

const JWT_PARAM = "jwt";
const TOKEN_KEY_PARAM = "acpt";
const TOKEN_KEY_HEADER = `X-${TOKEN_KEY_PARAM}`;
const AUTH_HEADER = "authorization";

function verify(addon) {
  return function (req, res, next) {
    function sendError(msg) {
      const code = 401;
      addon.logger.error("Uninstallation verification error:", code, msg);
      if (addon.config.expressErrorHandling()) {
        next({
          code,
          message: msg
        });
      } else {
        res.status(code).send(_.escape(msg));
      }
    }

    const regInfo = req.body;
    if (!regInfo || !_.isObject(regInfo)) {
      sendError("No registration info provided.");
      return;
    }

    // verify that the specified host is in the registration whitelist;
    // this can be spoofed, but is a first line of defense against unauthorized registrations
    const baseUrl = regInfo.baseUrl;
    if (!baseUrl) {
      sendError("No baseUrl provided in registration info.");
      return;
    }

    const host = urls.parse(baseUrl).hostname;
    const whitelisted = addon.config.whitelistRegexp().some(re => {
      return re.test(host);
    });
    if (!whitelisted) {
      return sendError(
        `Host at ${baseUrl} is not authorized to register as the host does not match the ` +
          `registration whitelist (${addon.config.whitelist()}).`
      );
    }

    const clientKey = regInfo.clientKey;
    if (!clientKey) {
      sendError(`No client key provided for host at ${baseUrl}.`);
      return;
    }

    authenticateUninstall(addon)(req, res, next);
  };
}

function authenticateUninstall(addon) {
  return function (req, res, next) {
    function sendError(msg) {
      const code = 401;
      addon.logger.error("Uninstallation verification error:", code, msg);
      if (addon.config.expressErrorHandling()) {
        next({
          code,
          message: msg
        });
      } else {
        res.status(code).send(_.escape(msg));
      }
    }
    const clientKey = req.body.clientKey;
    // Install / Uninstall hook should always be asymmetric (Excluding bitbucket apps)
    if (isJWTAsymmetric(addon, req)) {
      addon.authenticateAsymmetric()(req, res, () => {
        if (
          /no-auth/.test(process.env.AC_OPTS) ||
          req.context.clientKey === clientKey
        ) {
            console.log("haah");
          next();
        } else {
          sendError(
            "clientKey in uninstall payload did not match authenticated client"
          );
        }
      });
    } else {
      sendError(
        "Unexpected or missing JWT token, failed to verify uninstallation."
      );
    }
  };
}

function isJWTAsymmetric(addon, req) {
  const token = extractJwtFromRequest(addon, req);

  if (!token) {
    return false;
  }

  return jwt.AsymmetricAlgorithm.RS256 === jwt.getAlgorithm(token);
}

function extractJwtFromRequest (addon, req) {
    const tokenInQuery = req.query[JWT_PARAM];
  
    // JWT is missing in query and we don't have a valid body.
    if (!tokenInQuery && !req.body) {
      addon.logger.warn(
        `Cannot find JWT token in query parameters. Please include body-parser middleware and parse the urlencoded body (See https://github.com/expressjs/body-parser) if the add-on is rendering in POST mode. Otherwise please ensure the ${JWT_PARAM} parameter is presented in query.`
      );
      return;
    }
  
    // JWT appears in both parameter and body will result query hash being invalid.
    const tokenInBody = req.body[JWT_PARAM];
    if (tokenInQuery && tokenInBody) {
      addon.logger.warn(
        "JWT token can only appear in either query parameter or request body."
      );
      return;
    }
    let token = tokenInQuery || tokenInBody;
  
    // if there was no token in the query-string then fall back to checking the Authorization header
    const authHeader = req.headers[AUTH_HEADER];
    if (authHeader && authHeader.indexOf("JWT ") === 0) {
      if (token) {
        const foundIn = tokenInQuery ? "query" : "request body";
        addon.logger.warn(
          `JWT token found in ${foundIn} and in header: using ${foundIn} value.`
        );
      } else {
        token = authHeader.substring(4);
      }
    }
  
    // TODO: Remove when we discontinue the old token middleware
    if (!token) {
      token = req.query[TOKEN_KEY_PARAM] || req.header(TOKEN_KEY_HEADER);
    }
  
    return token;
};

module.exports = {
  verify,
  authenticateUninstall
};
