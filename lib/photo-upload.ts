// lib/photo-upload.ts

/**
 * Fonction d'upload pour Tauri/Capacitor/Web.
 * Retourne le contenu base64 de l'image ou un chemin local (simulé).
 * Dans cette version, on retourne directement le base64.
 */
export async function uploadProductImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Le résultat est une chaîne base64
      resolve(reader.result as string)
    }
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}