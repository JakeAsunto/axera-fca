"use strict";

class Operation {
  #id;
  #cancelled;
  #finished;
  #reason;
  #timer;

  /**
   * Create a new Operation instance.
   * @param {{ timeout: number }} options - Operation options.
   */
  constructor({ timeout } = {}) {
    this.#id = Math.random().toString(36).slice(2);
    this.#cancelled = false;
    this.#finished = false;

    if (timeout) {
      this.#timer = setTimeout(() => {
        this.cancel(new Error("Operation timed out"));
      }, timeout);
    }
  }
  
  getStatus() {
    return Object.freeze({
      id: this.#id,
      cancelled: this.#cancelled,
      finished: this.#finished,
      reason: this.#reason || null,
    })
  }

  cancel(reason = new Error("Operation cancelled")) {
    if (this.#finished || this.#cancelled) return;
    
    this.#cancelled = true;
    this.#reason = reason;
    
    clearTimeout(this.#timer);
  }

  finish() {
    if (this.#finished || this.#cancelled) return;
    this.#finished = true;
    clearTimeout(this.#timer);
  }
}
  
module.exports = Operation;