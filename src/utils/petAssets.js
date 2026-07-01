const path = require('path');
const fs = require('fs');
const { nativeImage } = require('electron');
const { pathToFileURL } = require('url');
const {
  PET_ASSETS_DIR,
  PET_IDLE_IMAGE,
  PET_DEFAULT_FORM,
  PET_FORM_ASSETS,
  PET_MAX_SIZE,
} = require('../app/constants');

function readGifDimensions(imagePath) {
  let fd;
  try {
    const buf = Buffer.alloc(10);
    fd = fs.openSync(imagePath, 'r');
    fs.readSync(fd, buf, 0, 10, 0);
    if (buf.toString('ascii', 0, 3) !== 'GIF') return null;
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt16LE(8);
    if (width > 0 && height > 0) return { width, height };
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function getPetAssetDimensions(imagePath) {
  const image = nativeImage.createFromPath(imagePath);
  const size = image.getSize();
  if (size.width > 0 && size.height > 0 && !image.isEmpty()) {
    return size;
  }

  if (path.extname(imagePath).toLowerCase() === '.gif') {
    const gifSize = readGifDimensions(imagePath);
    if (gifSize) return gifSize;
  }

  const fallback = nativeImage.createFromPath(PET_IDLE_IMAGE);
  const fallbackSize = fallback.getSize();
  if (fallbackSize.width > 0 && fallbackSize.height > 0) {
    return fallbackSize;
  }

  return { width: PET_MAX_SIZE, height: PET_MAX_SIZE };
}

function resolvePetFormAsset(form) {
  const key = PET_FORM_ASSETS[form] ? form : PET_DEFAULT_FORM;
  const filePath = path.join(PET_ASSETS_DIR, PET_FORM_ASSETS[key]);
  if (fs.existsSync(filePath)) return filePath;
  const fallback = path.join(PET_ASSETS_DIR, PET_FORM_ASSETS[PET_DEFAULT_FORM]);
  return fs.existsSync(fallback) ? fallback : PET_IDLE_IMAGE;
}

function scalePetSize(imageWidth, imageHeight, form = PET_DEFAULT_FORM) {
  if (!imageWidth || !imageHeight) {
    return { width: PET_MAX_SIZE, height: PET_MAX_SIZE };
  }
  let scale = Math.min(PET_MAX_SIZE / imageWidth, PET_MAX_SIZE / imageHeight);
  if (form === 'lantern') {
    scale *= 0.4;
  }
  return {
    width: Math.max(1, Math.round(imageWidth * scale)),
    height: Math.max(1, Math.round(imageHeight * scale)),
  };
}

function resolvePetImageSrc(spriteFileName) {
  const filePath = path.join(PET_ASSETS_DIR, spriteFileName);
  const resolved = fs.existsSync(filePath) ? filePath : PET_IDLE_IMAGE;
  return pathToFileURL(resolved).href;
}

function getAppIcon() {
  return nativeImage.createFromPath(PET_IDLE_IMAGE);
}

module.exports = {
  readGifDimensions,
  getPetAssetDimensions,
  resolvePetFormAsset,
  scalePetSize,
  resolvePetImageSrc,
  getAppIcon,
};
