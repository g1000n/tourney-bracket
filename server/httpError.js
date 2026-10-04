// An error that carries the HTTP status to answer with (404, 409…).
// server.js's error handler turns it into { error: message }.
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
