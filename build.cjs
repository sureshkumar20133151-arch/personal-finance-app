const fs = require('fs');

const originalRename = fs.promises.rename;
fs.promises.rename = async function (oldPath, newPath) {
    try {
        return await originalRename.call(this, oldPath, newPath);
    } catch (e) {
        if (e.code === 'EPERM' || e.code === 'EACCES') {
            console.log(`[Bypass] Caught EPERM on ${oldPath}. Using cpSync fallback!`);
            fs.cpSync(oldPath, newPath, { recursive: true });
            try { 
                fs.rmSync(oldPath, { recursive: true, force: true }); 
            } catch(err) {
                console.log(`[Bypass] Could not remove oldPath, but continuing...`);
            }
            return;
        } else {
            throw e;
        }
    }
};

const builder = require('electron-builder');
builder.build({
    config: require('./package.json').build
}).then(() => {
    console.log('Build completed successfully!');
}).catch((error) => {
    console.error('Build failed!', error);
    process.exit(1);
});
