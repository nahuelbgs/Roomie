/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  safelist: [
    "bg-gold",
    "bg-blossom",
    "bg-lavender",
    "bg-teal",
    "bg-malibu",
    "bg-coral",
    "bg-fantasy",
    "bg-smoky",
  ],
  theme: {
    extend: {
      colors: {
        fantasy: "#F5F4ED",
        gold: "#FFDA57",
        smoky: "#100F06",
        malibu: "#7DCAF6",
        lavender: "#A293FF",
        teal: "#00917A",
        blossom: "#FFBBF4",
        coral: "#F47575",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
