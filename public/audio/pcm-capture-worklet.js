/* global AudioWorkletProcessor, sampleRate, registerProcessor */

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions ?? {};
    this.inputSampleRate = config.inputSampleRate ?? sampleRate;
    this.targetSampleRate = config.targetSampleRate ?? 24000;
    this.chunkSamples = config.chunkSamples ?? 1200;
    this.ratio = this.inputSampleRate / this.targetSampleRate;
    this.sourcePosition = 0;
    this.pending = [];
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input?.length) return true;

    while (this.sourcePosition < input.length) {
      const sample = Math.max(-1, Math.min(1, input[Math.floor(this.sourcePosition)]));
      this.pending.push(sample < 0 ? sample * 32768 : sample * 32767);
      this.sourcePosition += this.ratio;
    }
    this.sourcePosition -= input.length;

    while (this.pending.length >= this.chunkSamples) {
      const samples = this.pending.splice(0, this.chunkSamples);
      const buffer = new ArrayBuffer(samples.length * 2);
      const view = new DataView(buffer);
      for (let index = 0; index < samples.length; index += 1) {
        view.setInt16(index * 2, samples[index], true);
      }
      this.port.postMessage(buffer, [buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
