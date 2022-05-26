import * as jwt from 'atlassian-jwt';
const documentHelper = require("../helpers/documentHelper.js");
const urlHelper = require("../helpers/urlHelper.js");

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
    });

    app.post('/configure', [addon.authenticate(true), addon.authorizeConfluence({ application: ["administer"] })], async (req, res) => {
        const httpClient = addon.httpClient(req);

        if (!req.body.docApiUrl || !req.body.jwtSecret || !req.body.jwtSecret) {
            res.status(400).send();
            return;
        }

        try {
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

    app.get('/onlyoffice-editor', addon.authenticate(), async (req, res) => {

        const userAccountId = req.context.userAccountId;
        const localBaseUrl = req.context.localBaseUrl;
        const hostBaseUrl = req.context.hostBaseUrl;
        const clientKey = req.context.clientKey;

        const pageId = req.query.pageId;
        const attachmentId = req.query.attachmentId;

        if (!pageId || !attachmentId) {
            addon.logger.warn("Not found requested paremeters (pageId or attachmentId)");
            sendError(
                404, 
                "Not found",
                "Attachment not found.",
                "Not found requested paremeters (pageId or attachmentId)."
            );
            return;
        }

        try {
            const httpClient = addon.httpClient(req);

            const userInfo = await getUserInfo(httpClient, userAccountId);
            const attachmentInfo = await getAttachmentInfo(httpClient, userAccountId, pageId, attachmentId); //ToDo: fileName

            const fileType = documentHelper.getFileExtension(attachmentInfo.title);
            const documentType = documentHelper.getDocumentType(fileType);

            if (!documentType) {
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
                'onlyoffice-editor.hbs',
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

        if (!queryToken) {
            res.status(400).send("Query token not found");
            return;
        }

        let context;
        try {
            context = await verifyQueryToken(addon, queryToken, "download");
        } catch (error) {
            res.status(401).send(`Invalid query token: ${error.message}`);
            return;
        }

        var httpClient = addon.httpClient({
            clientKey: context.clientKey
        });

        const jwtSecret = await getJwtSecret(addon, httpClient);

        if (jwtSecret) {
            const jwtHeader = await getJwtHeader(addon, httpClient);
            const authHeader = req.headers[jwtHeader.toLowerCase()];
            const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

            if (!token) {
                res.status(401).send("Could not find authentication data on request");
                return;
            }

            try {
                var bodyFromToken = jwt.decodeSymmetric(token, jwtSecret, jwt.SymmetricAlgorithm.HS256);
            } catch (error) {
                res.status(401).send(`Invalid JWT: ${error.message}`);
                return;
            }
        }

        // let canRead;
        // try {
        //     canRead = await checkPermissions(httpClient, context.userId, context.attachmentId, "read");
        // } catch (error) {
        //     res.status(403).send(error);
        //     return;
        // }

        // if (!canRead) {
        //     res.status(403).send("Forbidden: you don't have access to this content");
        //     return;
        // }

        const uri = await getUriDownloadAttachment(httpClient, context.userId, context.pageId, context.attachmentId);

        res.setHeader("location", uri);
        res.status(302).send();
    });

    app.post('/onlyoffice-callback', async (req, res) => {

        const queryToken = req.query.token;

        if (!queryToken) {
            res.status(400).send("Query token not found");
            return;
        }

        let context;
        try {
            context = await verifyQueryToken(addon, queryToken, "callback");
        } catch (error) {
            res.status(401).send(`Invalid query token: ${error.message}`);
            return;
        }

        let body = req.body;

        if (!body) {
            res.status(400).send("Request body not found");
            return;
        }

        const httpClient = addon.httpClient({
            clientKey: context.clientKey
        });

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
                res.status(401).send("Could not find authentication data on request");
                return;
            }

            try {
                var bodyFromToken = jwt.decodeSymmetric(token, jwtSecret, jwt.SymmetricAlgorithm.HS256);

                body = tokenFromHeader ? bodyFromToken.payload : bodyFromToken;
            } catch (error) {
                res.status(401).send(`Invalid JWT: ${error.message}`);
                return;
            }
        }

        if (body.status == 1) {

        } else if (body.status == 2 || body.status == 3) { // MustSave, Corrupted
            const userAccountId = body.actions[0].userid;
            const pageId = context.pageId;
            const attachmentId = context.attachmentId;

            // let permissionEdit;
            // try {
            //     permissionEdit = await checkPermissions(httpClient, context.userId, context.attachmentId, "update");
            // } catch (error) {
            //     res.status(403).send(error);    //ToDo warn log
            // }
            
            if (!permissionEdit) {
                res.status(403).send("Forbidden: you don't have access to edit this content");
                return;
            }

            const fileData = await getFileDataFromUrl(body.url);
            const error = await updateContent(httpClient, userAccountId, pageId, attachmentId, fileData);
        } else if (body.status == 6 || body.status == 7) { // MustForceSave, CorruptedForceSave
            res.json({ error: 1, message: "Force save is not supported"});
            return;
        }

        res.json({ error: 0 });
    });
}
