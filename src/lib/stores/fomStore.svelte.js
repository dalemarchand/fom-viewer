let files = $state([]);
let mergedFOM = $state(null);

export function getFiles() {
  return files;
}

export function getMergedFOM() {
  return mergedFOM;
}

export function setFiles(newFiles) {
  files = newFiles;
}

export function setMergedFOM(fom) {
  mergedFOM = fom;
}

export function addFile(file) {
  files = [...files, file];
}

export function removeFile(index) {
  files = files.filter((_, i) => i !== index);
}

export function clearFiles() {
  files = [];
  mergedFOM = null;
}

export function hasFiles() {
  return files.length > 0;
}
