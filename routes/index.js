import * as jwt from 'atlassian-jwt';
const documentHelper = require("../helpers/documentHelper.js");
const urlHelper = require("../helpers/urlHelper.js");
const util = require("util");

const {
    setAppProperty,
    getAttachmentInfo,
    getUserInfo,
    updateContent,
    getUriDownloadAttachment,
    getFileDataFromUrl
} = require("../helpers/requestHelper.js");

const {
    getJwtSecret,
    getJwtHeader,
    verifyQueryToken
} = require("../helpers/jwtManager.js");

export default function routes(app, addon) {
    // Redirect root path to /atlassian-connect.json,
    // which will be served by atlassian-connect-express.
    app.get('/', (req, res) => {
        res.redirect('/atlassian-connect.json');
    });

    app.get('/configure', [addon.authenticate(), addon.authorizeConfluence({ application: ["administer"] })], async (req, res) => {
        
        try {
            const httpClient = addon.httpClient(req);

            const context = {
                title: "ONLYOFFICE",
                docApiUrl: await urlHelper.getDocApiUrl(addon, httpClient),
                jwtSecret: await getJwtSecret(addon, httpClient),
                jwtHeader: await getJwtHeader(addon, httpClient)
            };

            res.render(
                'configure.hbs',
                context
            );
        } catch (error) {
            addon.logger.warn(error);
            res.render(
                'error.hbs',
                {
                    error: {
                        code: error.code || 500, 
                        type: error.type || "Undefined error",
                        message: error.message || "",
                        description: error.description || ""
                    }
                }
            );
        }
    });

    app.post('/configure', [addon.authenticate(true), addon.authorizeConfluence({ application: ["administer"] })], async (req, res) => {

        if (!req.body.docApiUrl || !req.body.jwtSecret || !req.body.jwtSecret) {
            res.status(400).send();
            return;
        }

        try {
            const httpClient = addon.httpClient(req);

            let docApiUrl = setAppProperty(httpClient, "docApiUrl", req.body.docApiUrl);
            let jwtSecret = setAppProperty(httpClient, "jwtSecret", req.body.jwtSecret);
            let jwtHeader = setAppProperty(httpClient, "jwtHeader", req.body.jwtHeader);
            Promise.all([docApiUrl, jwtSecret, jwtHeader]).then(values => {
                res.status(200).send();
            });
        } catch (error) {
            addon.logger.warn(error);
            res.status(500).send("Internal error");
        }
    });

    app.get('/editor', addon.authenticate(), async (req, res) => {

        const userAccountId = req.context.userAccountId;
        const localBaseUrl = req.context.localBaseUrl;
        const hostBaseUrl = req.context.hostBaseUrl;
        const clientKey = req.context.clientKey;

        const pageId = req.query.pageId;
        const attachmentId = req.query.attachmentId;
        const attachmentName = req.query.attachmentName;

        addon.logger.info(`Request to generate a configuration to open the editor:\n${util.inspect({
            clientKey: clientKey,
            hostBaseUrl: hostBaseUrl,
            userAccountId: userAccountId,
            pageId: pageId,
            attachmentId: attachmentId,
            attachmentName: attachmentName
        })}`);

        if (!pageId || !attachmentId || !attachmentName) {
            addon.logger.warn("Not found requested paremeters (pageId, attachmentId, attachmentName)");
            sendError(
                404, 
                "Not found",
                "Attachment not found.",
                "Not found requested paremeters (pageId, attachmentId, attachmentName)."
            );
            return;
        }

        try {
            const httpClient = addon.httpClient(req);

            const userInfo = await getUserInfo(httpClient, userAccountId);
            const attachmentInfo = await getAttachmentInfo(httpClient, userAccountId, pageId, attachmentId, attachmentName);

            const fileType = documentHelper.getFileExtension(attachmentInfo.title);
            const documentType = documentHelper.getDocumentType(fileType);

            if (!documentType) {
                addon.logger.warn(`Unsupported MediaType: this file format is not supported (${fileType})`);
                sendError(
                    415, 
                    "Unsupported MediaType",
                    `Sorry, this file format is not supported (${fileType})`
                );
                return;
            } 

            const editorConfig = await documentHelper.getEditorConfig(
                addon, 
                clientKey, 
                localBaseUrl, 
                hostBaseUrl, 
                attachmentInfo, 
                userInfo
            );

            const jwtSecret = await getJwtSecret(addon, httpClient);

            if (jwtSecret) {
                editorConfig.token = jwt.encodeSymmetric(editorConfig, jwtSecret);
            }

            res.render(
                'editor.hbs',
                {
                    editorConfig: JSON.stringify(editorConfig),
                    docApiUrl: await urlHelper.getDocApiUrl(addon, httpClient)
                }
            );
        } catch (error) {
            addon.logger.warn(error);
            sendError(
                error.code || 500,
                error.type || "Undefined error",
                error.message || "An unexpected error occurred while opening the document.",
                error.description || ""
            )
            return;
        }

        function sendError(code, type, message, description) {
            res.render(
                'error.hbs',
                {
                    error: {
                        code: code, 
                        type: type,
                        message: message,
                        description: description
                    }
                }
            );
        }
    });

    app.get('/onlyoffice-download', async (req, res) => {

        const queryToken = req.query.token;

        addon.logger.info(`Request to download file:\n${util.inspect({ queryToken: queryToken })}`);

        if (!queryToken) {
            addon.logger.warn("Query token not found");
            res.status(400).send("Query token not found");
            return;
        }

        let context;
        try {
            context = await verifyQueryToken(addon, queryToken, "download");
        } catch (error) {
            addon.logger.warn(`Invalid query token: ${error.message}`);
            res.status(401).send(`Invalid query token: ${error.message}`);
            return;
        }

        addon.logger.info(`Context from queryToken:\n${util.inspect(context)}`);

        var httpClient = addon.httpClient({
            clientKey: context.clientKey
        });

        try {
            const jwtSecret = await getJwtSecret(addon, httpClient);

            if (jwtSecret) {
                const jwtHeader = await getJwtHeader(addon, httpClient);
                const authHeader = req.headers[jwtHeader.toLowerCase()];
                const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

                if (!token) {
                    addon.logger.warn("Could not find authentication data on request");
                    res.status(401).send("Could not find authentication data on request");
                    return;
                }

                try {
                    var bodyFromToken = jwt.decodeSymmetric(token, jwtSecret, jwt.SymmetricAlgorithm.HS256);
                } catch (error) {
                    addon.logger.warn(`Invalid JWT: ${error.message}`);
                    res.status(401).send(`Invalid JWT: ${error.message}`);
                    return;
                }
            }

            const uri = await getUriDownloadAttachment(httpClient, context.userId, context.pageId, context.attachmentId);

            res.setHeader("location", uri);
            res.status(302).send();
        } catch (error) {
            addon.logger.warn(`Error download file:\n${util.inspect(error)}`);
            res.status(error.code || 500).send(error.message || "Undefined error.");
        }
    });

    app.post('/onlyoffice-callback', async (req, res) => {

        const queryToken = req.query.token;

        addon.logger.info(`Callback request:\n${util.inspect({ queryToken: queryToken })}`);

        if (!queryToken) {
            addon.logger.warn("Query token not found");
            res.status(400).send("Query token not found");
            return;
        }

        let context;
        try {
            context = await verifyQueryToken(addon, queryToken, "callback");
        } catch (error) {
            addon.logger.warn(`Invalid query token: ${error.message}`);
            res.status(401).send(`Invalid query token: ${error.message}`);
            return;
        }

        addon.logger.info(`Context from queryToken:\n${util.inspect(context)}`);

        let body = req.body;

        if (!body) {
            addon.logger.warn("Request body not found");
            res.status(400).send("Request body not found");
            return;
        }

        const httpClient = addon.httpClient({
            clientKey: context.clientKey
        });

        try {
            const jwtSecret = await getJwtSecret(addon, httpClient);

            if (jwtSecret) {
                let token = body.token;
                let tokenFromHeader = false;

                if (!token) {
                    const jwtHeader = await getJwtHeader(addon, httpClient);
                    const authHeader = req.headers[jwtHeader.toLowerCase()];
                    token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
                    tokenFromHeader = true;
                }

                if (!token) {
                    addon.logger.warn("Could not find authentication data on request");
                    res.status(401).send("Could not find authentication data on request");
                    return;
                }

                try {
                    var bodyFromToken = jwt.decodeSymmetric(token, jwtSecret, jwt.SymmetricAlgorithm.HS256);

                    body = tokenFromHeader ? bodyFromToken.payload : bodyFromToken;
                } catch (error) {
                    addon.logger.warn(`Invalid JWT: ${error.message}`);
                    res.status(401).send(`Invalid JWT: ${error.message}`);
                    return;
                }
            }

            addon.logger.info(`Callback status: ${body.status}`);
               
            if (body.status == 2 || body.status == 3) { // MustSave, Corrupted

                const userAccountId = body.actions[0].userid;
                const pageId = context.pageId;
                const attachmentId = context.attachmentId;

                const fileData = await getFileDataFromUrl(body.url);
                const attachmentInfo = await updateContent(httpClient, userAccountId, pageId, attachmentId, fileData);
            } else if (body.status == 6 || body.status == 7) { // MustForceSave, CorruptedForceSave
                addon.logger.warn("Force save is not supported");
                res.json({ error: 1, message: "Force save is not supported"});
                return;
            }
        } catch (error) {
            addon.logger.warn(`Callback request error:\n${util.inspect(error)}`);
            res.json({ error: 1, message: error.message || "Undefined error." });
            return;
        }

        res.json({ error: 0 });
    });
}
