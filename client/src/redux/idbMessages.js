import { openDB } from 'idb'

export const DB_NAME = 'messages',
             STORE_MESSAGES_USAGERS = 'messagesUsagers',
             VERSION_COURANTE = 3

function ouvrirDB(opts) {
    opts = opts || {}

    return openDB(DB_NAME, VERSION_COURANTE, {
        upgrade(db, oldVersion, newVersion, transaction) {
            createObjectStores(db, oldVersion, newVersion, transaction)
        },
        blocked() {
            console.error("OpenDB %s blocked", DB_NAME)
        },
        blocking() {
            console.warn("OpenDB, blocking")
        }
    })

}

export default ouvrirDB

function createObjectStores(db, oldVersion, newVersion, transaction) {
    /*eslint no-fallthrough: "off"*/
    console.info("DB fichiers upgrade de %s a %s", oldVersion, newVersion)
    let messagesStore = null
    try {
        switch(oldVersion) {
            case 0:
            case 1:
            case 2: // Version initiale
                messagesStore = db.createObjectStore(STORE_MESSAGES_USAGERS, {keyPath: 'message_id'})
                messagesStore.createIndex('userBucket', ['user_id', 'bucket'], {unique: false, multiEntry: false})
            case 3: // Version courante
                break
            default:
                console.warn("createObjectStores Default..., version %O", oldVersion)
        }
    } catch(err) {
        console.error("Erreur preparation IDB : ", err)
        throw err
    }
}
