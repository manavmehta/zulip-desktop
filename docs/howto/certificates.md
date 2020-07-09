## Handling Certificates

Up to Zulip-Desktop v5.3.0, the application supports certificates stored in Zulip store i.e the certificate user adds from the Settings page of the application.

Release v5.4.0 adds the support for certificates from the system store, which means the certificates added by the user in the root certificate store would also be supported and there is no need to configure the same certificate in Zulip store again.


## Deprecation Warning

We are moving entirely to the system store, similar to what Chromium does, and thus the next release will not support certificates from Zulip store and will thereby throw errors.
Hence, the users are advised to switch to root certificate store.


## Adding and removing certificates from system store

See [Chromium Root Certificate Policy](https://sites.google.com/a/chromium.org/dev/Home/chromium-security/root-ca-policy) for more info.

### macOS
* Hit `Cmd+Space` to bring up Spotlight Search and open Keychain Access Util.
* Go to `File` menu and click on `Import Item` or press `Cmd+Shift+I` and select your certificate to import it.

The above task can also be done by double-clicking the cert file. The steps above just make the procedure effective.
* Now right click your cert file in the Keychain Access Util itself and click on `Get Info`.
* Expand the `Trust` menu and from `When using this cerficate` dropdown, select `Always Trust`.

Certificate can be removed likewise.


### Windows
* Open Chrome Settings or navigate to `chrome://settings/`.
* Click on `Advanced` at the bottom of the page.
* Go to `Manage Certificates`.
* Else you can also navigate to `Security` and find `Manage Certificates`.
* Select `Authorities`.
* Select `Import` and select your certificate to import it.
* Select `Done`.


### Linux
Use Linux Cert Management for managing certificates.
Please visit [Chromium Docs](https://chromium.googlesource.com/chromium/src.git/+/master/docs/linux/cert_management.md) for detailed procedure.


#### In order to add the server, the application must be restarted after adding the certificates.
