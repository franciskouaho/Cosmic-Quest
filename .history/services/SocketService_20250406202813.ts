import { io, Socket } from "socket.io-client"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"

// Remplacez par l'URL de votre backend
const SOCKET_URL = "https://your-backend-url.com"

class SocketService {
    private socket: Socket | null = null
    private reconnectAttempts = 0
    private maxReconnectAttempts = 10
    private reconnectDelay = 1000
    private userId: string | null = null
    private eventListeners: Map<string, Function[]> = new Map()
    private queuedEvents: { event: string; data: any }[] = []
    private isConnected = false
    private isConnecting = false
    private networkListener: any = null

    constructor() {
        // Surveillance de la connectivité réseau
        this.setupNetworkListener()
    }

    private setupNetworkListener() {
        this.networkListener = NetInfo.addEventListener(state => {
            if (state.isConnected && this.userId && !this.isConnected && !this.isConnecting) {
                this.connect(this.userId)
            }
        })
    }

    public connect(userId: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.isConnecting) {
                resolve(false)
                return
            }

            this.isConnecting = true
            this.userId = userId

            // Si déjà connecté avec le même userId, ne pas reconnecter
            if (this.isConnected && this.socket) {
                this.isConnecting = false
                resolve(true)
                return
            }

            // Fermer la connexion existante si nécessaire
            if (this.socket) {
                this.socket.close()
                this.socket = null
            }

            this.socket = io(SOCKET_URL, {
                auth: { userId },
                transports: ["websocket"],
                reconnection: false, // On gère manuellement la reconnexion
            })

            this.socket.on("connect", () => {
                console.log("Socket connected")
                this.isConnected = true
                this.isConnecting = false
                this.reconnectAttempts = 0
                this.flushQueuedEvents()
                resolve(true)
                
                // Émettre l'événement à tous les listeners
                this.emit("connection:status", { connected: true })
            })

            this.socket.on("disconnect", (reason) => {
                console.log("Socket disconnected:", reason)
                this.isConnected = false
                this.handleDisconnect(reason)
                
                // Émettre l'événement à tous les listeners
                this.emit("connection:status", { connected: false, reason })
            })

            this.socket.on("connect_error", (error) => {
                console.error("Socket connection error:", error)
                this.isConnected = false
                this.isConnecting = false
                this.handleDisconnect("connect_error")
                resolve(false)
                
                // Émettre l'événement à tous les listeners
                this.emit("connection:status", { connected: false, error: error.message })
            })

            // Rétablir les listeners pour les événements
            for (const [event, listeners] of this.eventListeners.entries()) {
                for (const listener of listeners) {
                    this.socket.on(event, listener)
                }
            }
        })
    }

    private handleDisconnect(reason: string) {
        // Ne pas tenter de se reconnecter si la déconnexion était volontaire
        if (reason === "io client disconnect" || reason === "io server disconnect") {
            return
        }

        // Tenter de se reconnecter
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.userId) {
            this.reconnectAttempts++
            const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5)
            
            console.log(`Tentative de reconnexion dans ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
            
            setTimeout(() => {
                if (!this.isConnected && !this.isConnecting && this.userId) {
                    this.connect(this.userId)
                }
            }, delay)
        } else {
            console.log("Nombre maximum de tentatives de reconnexion atteint")
        }
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }
        
        if (this.networkListener) {
            this.networkListener()
        }
        
        this.isConnected = false
        this.isConnecting = false
        this.userId = null
        this.queuedEvents = []
    }

    public on(event: string, callback: Function) {
        // Stocker le callback dans notre map d'event listeners
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, [])
        }
        this.eventListeners.get(event)!.push(callback)

        // Ajouter l'écouteur au socket si connecté
        if (this.socket) {
            this.socket.on(event, callback)
        }

        // Retourner une fonction pour supprimer l'écouteur
        return () => this.off(event, callback)
    }

    public off(event: string, callback: Function) {
        // Supprimer le callback de notre map d'event listeners
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event)!
            const index = listeners.indexOf(callback)
            if (index !== -1) {
                listeners.splice(index, 1)
            }
            if (listeners.length === 0) {
                this.eventListeners.delete(event)
            }
        }

        // Supprimer l'écouteur du socket si connecté
        if (this.socket) {
            this.socket.off(event, callback as any)
        }
    }

    public emit(event: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected || !this.socket) {
                // Mettre en file d'attente les événements si pas connecté
                this.queuedEvents.push({ event, data })
                reject(new Error("Socket not connected"))
                return
            }

            try {
                // Cas avec callback pour la réponse
                if (event.endsWith(":request")) {
                    const responseEvent = event.replace(":request", ":response")
                    const timeout = setTimeout(() => {
                        this.off(responseEvent, responseHandler)
                        reject(new Error("Socket request timeout"))
                    }, 10000) // Timeout de 10 secondes

                    const responseHandler = (response: any) => {
                        clearTimeout(timeout)
                        this.off(responseEvent, responseHandler)
                        resolve(response)
                    }

                    this.on(responseEvent, responseHandler)
                    this.socket.emit(event, data)
                } else {
                    // Cas sans callback
                    this.socket.emit(event, data)
                    resolve(true)
                }
            } catch (error) {
                reject(error)
            }
        })
    }

    private flushQueuedEvents() {
        if (!this.isConnected || !this.socket) return

        const events = [...this.queuedEvents]
        this.queuedEvents = []

        for (const { event, data } of events) {
            this.socket.emit(event, data)
        }
    }

    public isSocketConnected(): boolean {
        return this.isConnected
    }
}

// Singleton
export default new SocketService()
