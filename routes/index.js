import * as jwt from 'atlassian-jwt';

const documentHelper = require("../helpers/documentHelper.js");
const urlHelper = require("../helpers/urlHelper.js");

const {
    setAppProperty,
    getAttachmentInfo,
    getUserInfo,
    checkPermissions,
    updateContent,
    getUriDownloadAttachment,
    getFileDataFromUrl
} = require("../helpers/requestHelper.js");

const {
    getJwtSecret,
    getJwtHeader
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
            setAppProperty(httpClient, "docApiUrl", req.body.docApiUrl);
            setAppProperty(httpClient, "jwtSecret", req.body.jwtSecret);
            setAppProperty(httpClient, "jwtHeader", req.body.jwtHeader);
        } catch (error) {
            res.status(500).send("Internal error");
        }

        res.status(200).send();
    });

    app.get('/onlyoffice-editor', addon.authenticate(), async (req, res) => {

        const httpClient = addon.httpClient(req);
        const userAccountId = req.context.userAccountId;
        const localBaseUrl = req.context.localBaseUrl;
        const hostBaseUrl = req.context.hostBaseUrl;
        const clientKey = req.context.clientKey
        const pageId = req.query.pageId;
        const attachmentId = req.query.attachmentId;

        let context = {
            title: "ONLYOFFICE",
            docApiUrl: await urlHelper.getDocApiUrl(addon, httpClient)
        };

        try {
            const canRead = await checkPermissions(httpClient, userAccountId, attachmentId, "read");
            if (!canRead) {
                res.status(403).send("Forbidden: you don't have access to this content");
                return;
            }

            const userInfo = await getUserInfo(httpClient, userAccountId);
            const attachmentInfo = await getAttachmentInfo(httpClient, pageId, attachmentId);

            const fileType = documentHelper.getFileExtension(attachmentInfo.title);
            const documentType = documentHelper.getDocumentType(fileType);

            if (!documentType) {
                context.error = `Sorry, this file format is not supported (${fileType})`;
            } else {
                const permissionEdit = await checkPermissions(httpClient, userAccountId, attachmentId, "update");
                const editorConfig = documentHelper.getEditorConfig(clientKey, localBaseUrl, hostBaseUrl, attachmentInfo, userInfo, permissionEdit);

                const jwtSecret = await getJwtSecret(addon, httpClient);

                if (jwtSecret) {
                    editorConfig.token = jwt.encodeSymmetric(editorConfig, jwtSecret);
                }

                context.editorConfig = JSON.stringify(editorConfig);
            }
        } catch (error) {
            console.log(error);
            res.status(500).send("Internal error"); // ToDo: error
        }

        res.render(
            'onlyoffice-editor.hbs',
            context
        );
    });

    app.get('/onlyoffice-download', async (req, res) => {

        var httpClient = addon.httpClient({
            clientKey: req.query.clientKey
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

        const pageId = req.query.pageId;
        const attachmentId = req.query.attachmentId;

        if (!pageId || !attachmentId) {
            res.status(400).send();
            return;
        }

        const uri = await getUriDownloadAttachment(httpClient, pageId, attachmentId);

        res.setHeader("location", uri);
        res.status(302).send();
    });

    app.post('/onlyoffice-callback', async (req, res) => {

        let body = req.body;

        if (!body) {
            res.status(400).send();
            return;
        }

        const httpClient = addon.httpClient({
            clientKey: req.query.clientKey
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
            const pageId = req.query.pageId;
            const attachmentId = req.query.attachmentId;
                
            const fileData = await getFileDataFromUrl(body.url);
            const error = await updateContent(httpClient, userAccountId, pageId, attachmentId, fileData);
        } else if (body.status == 6 || body.status == 7) { // MustForceSave, CorruptedForceSave
            res.json({ error: 1, message: "Force save is not supported"});
        }

        res.json({ error: 0 });
    });
}
