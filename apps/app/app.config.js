// app.json-u genişləndirir: veb tətbiq alt qovluqda (məs. GitHub Pages: /Kariyeram-Accademy) yerləşəndə
// EXPO_BASE_URL verilir ki, fayl və marşrut ünvanları düzgün qurulsun. Verilməsə kök ünvan işlənir.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
})
