import logging

from millegrilles_web.WebServer import WebServer

from server_messages import Constantes as ConstantesMessages
from server_messages.SocketIoMessagesHandler import SocketIoMessagesHandler


class WebServerMessages(WebServer):

    def __init__(self, etat, commandes):
        self.__logger = logging.getLogger(__name__ + '.' + self.__class__.__name__)
        super().__init__(ConstantesMessages.WEBAPP_PATH, etat, commandes)

    def get_nom_app(self) -> str:
        return ConstantesMessages.APP_NAME

    async def setup_socketio(self):
        """ Wiring socket.io """
        # Utiliser la bonne instance de SocketIoHandler dans une sous-classe
        self._socket_io_handler = SocketIoMessagesHandler(self, self._stop_event)
        await self._socket_io_handler.setup()

    async def _preparer_routes(self):
        self.__logger.info("Preparer routes %s sous /%s" % (self.__class__.__name__, self.get_nom_app()))
        await super()._preparer_routes()
