const os = require("node:os");
const { performance } = require("node:perf_hooks");
const { PredictiveModel, normalizePredictiveSettings } = require("../build/lib/predictive.js");

const models = Math.max(1, Number(process.argv[2] || 1));
const points = Math.max(1, Number(process.argv[3] || 2000));
const settings = normalizePredictiveSettings({
	enabled: true,
	minimumTrainingSamples: 120,
	maximumTrainingPoints: points,
});
const rssBefore = process.memoryUsage().rss;
let peakRss = rssBefore;
const cpuBefore = process.cpuUsage();
const started = performance.now();
const instances = Array.from({ length: models }, () => new PredictiveModel(settings));
for (const model of instances) {
	for (let index = 0; index < points; index++) {
		const cycle = index % 1440;
		model.add(45 + 8 * Math.sin((cycle / 1440) * Math.PI * 2) + (index % 37) * 0.01, index * 60_000);
	}
	peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
const trained = performance.now();
for (const model of instances) {
	model.train(Date.now());
	peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
const finished = performance.now();
const cpu = process.cpuUsage(cpuBefore);
const rssAfter = process.memoryUsage().rss;
console.log(
	JSON.stringify(
		{
			models,
			trainingPointsPerModel: points,
			trainingMsTotal: +(trained - started).toFixed(2),
			trainingMsPerModel: +((trained - started) / models).toFixed(2),
			forecastMsTotal: +(finished - trained).toFixed(2),
			rssBeforeMB: +(rssBefore / 1024 / 1024).toFixed(2),
			rssPeakMB: +(peakRss / 1024 / 1024).toFixed(2),
			rssAfterMB: +(rssAfter / 1024 / 1024).toFixed(2),
			rssDeltaMB: +((rssAfter - rssBefore) / 1024 / 1024).toFixed(2),
			cpuMs: +((cpu.user + cpu.system) / 1000).toFixed(2),
			modelBytes: Buffer.byteLength(JSON.stringify(instances[0].toJSON())),
			node: process.version,
			platform: process.platform,
			arch: process.arch,
			cpuModel: os.cpus()[0]?.model || "unknown",
			totalMemoryMB: +(os.totalmem() / 1024 / 1024).toFixed(2),
			statuses: instances.map(model => model.train().status),
		},
		null,
		2,
	),
);
