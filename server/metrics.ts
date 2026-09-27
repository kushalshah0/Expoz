export interface MetricsSnapshot {
  activeTunnels: number
  requestsTotal: number
  responsesTotal: number
  errorsTotal: number
  requestBytes: number
  responseBytes: number
}

export class Metrics {
  private state: MetricsSnapshot = {
    activeTunnels: 0,
    requestsTotal: 0,
    responsesTotal: 0,
    errorsTotal: 0,
    requestBytes: 0,
    responseBytes: 0
  }

  tunnelConnected(): void {
    this.state.activeTunnels += 1
  }

  tunnelDisconnected(): void {
    this.state.activeTunnels = Math.max(0, this.state.activeTunnels - 1)
  }

  requestStarted(): void {
    this.state.requestsTotal += 1
  }

  requestBytesReceived(bytes: number): void {
    this.state.requestBytes += bytes
  }

  responseCompleted(statusCode: number): void {
    this.state.responsesTotal += 1
    if (statusCode >= 400) this.state.errorsTotal += 1
  }

  responseBytesSent(bytes: number): void {
    this.state.responseBytes += bytes
  }

  error(): void {
    this.state.errorsTotal += 1
  }

  snapshot(): MetricsSnapshot {
    return { ...this.state }
  }
}
