const Jimp = require('jimp');

async function fixImage(imagePath) {
    try {
        console.log(`Reading ${imagePath}...`);
        const image = await Jimp.read(imagePath);
        console.log(`Successfully read ${imagePath}. Saving as PNG...`);
        await image.writeAsync(imagePath);
        console.log(`Successfully saved ${imagePath} as a valid PNG.`);
    } catch (e) {
        console.error(`Failed to process ${imagePath}:`, e);
    }
}

async function main() {
    await fixImage('../apps/mobile/assets/icon.png');
    await fixImage('../apps/mobile/assets/android-icon-foreground.png');
    await fixImage('../apps/mobile/assets/android-icon-background.png');
    await fixImage('../apps/mobile/assets/android-icon-monochrome.png');
    await fixImage('../apps/mobile/assets/favicon.png');
}

main();
