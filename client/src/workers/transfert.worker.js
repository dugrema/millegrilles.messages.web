import { expose } from 'comlink'
import * as FiletransferDownloadClient from '../transferts/filetransferDownloadClient'
expose({...FiletransferDownloadClient})