import socketService from '#services/socket_service'
import { HttpContext } from '@adonisjs/core/http'
import GameController from '#controllers/ws/game_controller'
import RecoveryController from '#controllers/ws/recovery_controller'

export default function () {
  HttpContext.getter(
    'socket',
    function () {
      return {
        /**
         * Récupérer une instance du service socket
         */
        getService: () => socketService,

        /**
         * Émettre un événement sur un canal spécifique
         */
        emit: function (event: string, data: any) {
          socketService.broadcast(event, data)
        },

        /**
         * Récupérer le contrôleur de jeu
         */
        getGameController: () => {
          return new GameController()
        },

        /**
         * Récupérer le contrôleur de récupération
         */
        getRecoveryController: () => {
          return new RecoveryController()
        },
      }
    },
    true
  )
}
