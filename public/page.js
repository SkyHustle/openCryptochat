/** The core Vue instance controlling the UI */
const vm = new Vue ({
  el: '#vue-instance',
  data () {
    return {
      cryptWorker: null,
      socket: null,
      originPublicKey: null,
      destinationPublicKey: null,
      messages: [],
      notifications: [],
      currentRoom: null,
      pendingRoom: Math.floor(Math.random() * 1000),
      draft: ''
    }
  },
  async created () {
    this.addNotification('Welcome! Generating a new keypair now.')

    // Initialize crypto webworker thread
    this.cryptWorker = new Worker('crypto-worker.js')

    // Generate keypair and join default room
    this.originPublicKey = await this.getWebWorkerResponse('generate-keys')
    this.addNotification('Keypair Generated')

    // Initialize socketio
    this.socket = io()
    this.setupSocketListeners()
  },
  methods: {
    setupSocketListeners () {
      // Automatically join default room on connect
      this.socket.on('connect', () => {
        this.addNotification('Connected To Server.')
        this.joinRoom()
      })

      // Notify user that they have lost the socket connection
      this.socket.on('disconnect', () => this.addNotification('Lost Connection'))

      // Display message when recieved
      this.socket.on('MESSAGE', (message) => {
        this.addMessage(message)
      })
    },

    /** Send the current draft message */
    sendMessage () {
      // Don't send message if there is nothing to send
      if (!this.draft || this.draft === '') { return }

      const message = this.draft

      // Reset the UI input draft text
      this.draft = ''

      // Instantly add message to local UI
      this.addMessage(message)

      // Emit the message
      this.socket.emit('MESSAGE', message)
    },

    /** Join the chatroom */
    joinRoom () {
      this.socket.emit('JOIN')
    },

    /** Add message to UI */
    addMessage (message) {
      this.messages.push(message)
    },
    /** Append a notification message in the UI */
    addNotification (message) {
      const timestamp = new Date().toLocaleTimeString()
      this.notifications.push({ message, timestamp })
    },
    /** Post a message to the web worker and return a promise that will resolve with the response.  */
    getWebWorkerResponse (messageType, messagePayload) {
      return new Promise((resolve, reject) => {
        // Generate a random message id to identify the corresponding event callback
        const messageId = Math.floor(Math.random() * 100000)

        // Post the message to the webworker
        this.cryptWorker.postMessage([messageType, messageId].concat(messagePayload))

        // Create a handler for the webworker message event
        const handler = function (e) {
          // Only handle messages with the matching message id
          if (e.data[0] === messageId) {
            // Remove the event listener once the listener has been called.
            e.currentTarget.removeEventListener(e.type, handler)

            // Resolve the promise with the message payload.
            resolve(e.data[1])
          }
        }

        // Assign the handler to the webworker 'message' event.
        this.cryptWorker.addEventListener('message', handler)
      })
    }
  }
})