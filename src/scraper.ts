import puppeteer from "puppeteer";
import fs from "fs";
import axios from "axios";

async function getRandomImage(): Promise<string | null> {
    const url = "https://source.unsplash.com/random"; // Fuente de imágenes aleatorias
    const imagePath = "random.jpg";

    try {
        const response = await axios({
            url,
            responseType: "stream",
        });

        response.data.pipe(fs.createWriteStream(imagePath));

        return new Promise((resolve, reject) => {
            response.data.on("end", () => resolve(imagePath));
            response.data.on("error", (err: any) => reject(err));
        });
    } catch (error) {
        console.error("Error al descargar la imagen:", error);
        return null;
    }
}

export { getRandomImage };
