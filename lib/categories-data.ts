import { dbExecute, dbSelect } from '@/src/lib/db'

export interface Category {
  id: string
  nameFr: string
  nameAr: string | null
  color: string | null
  createdAt: string
}

interface CategoryRow {
  id: string
  name_fr: string
  name_ar: string | null
  color: string | null
  created_at: string
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    nameFr: row.name_fr,
    nameAr: row.name_ar,
    color: row.color,
    createdAt: row.created_at,
  }
}

export async function getAllCategories(): Promise<Category[]> {
  // Utilisation de GROUP BY pour éliminer les doublons basés sur le nom
  const rows = await dbSelect<CategoryRow>(
    `SELECT id, name_fr, name_ar, color, created_at 
     FROM categories 
     GROUP BY name_fr 
     ORDER BY name_fr ASC`
  )
  return rows.map(mapRow)
}

export async function createCategory(
  nameFr: string,
  nameAr?: string,
  color?: string
): Promise<string> {
  const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  // Vérifier si une catégorie avec ce nom existe déjà
  const existing = await dbSelect<{ id: string }>(
    `SELECT id FROM categories WHERE name_fr = ?`,
    [nameFr]
  )

  if (existing.length > 0) {
    // Retourner l'ID existant au lieu de créer un doublon
    return existing[0].id
  }

  await dbExecute(
    `INSERT INTO categories (id, name_fr, name_ar, color, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, nameFr, nameAr || null, color || null, now]
  )
  return id
}

export async function seedDefaultCategories(): Promise<void> {
  // Nettoyer d'abord les doublons existants
  await cleanDuplicateCategories()

  const existing = await getAllCategories()
  if (existing.length > 0) return

  const defaults = [
    { fr: 'Épicerie', ar: 'بقالة', color: '#F59E0B' },
    { fr: 'Boissons', ar: 'مشروبات', color: '#3B82F6' },
    { fr: 'Produits laitiers', ar: 'منتجات الألبان', color: '#10B981' },
    { fr: 'Boulangerie', ar: 'مخبزة', color: '#F97316' },
    { fr: 'Hygiène', ar: 'نظافة', color: '#8B5CF6' },
    { fr: 'Cosmétiques', ar: 'مستحضرات التجميل', color: '#EC4899' },
    { fr: 'Électronique', ar: 'إلكترونيات', color: '#6366F1' },
    { fr: 'Vêtements', ar: 'ملابس', color: '#14B8A6' },
    { fr: 'Divers', ar: 'متنوع', color: '#6B7280' },
  ]

  for (const cat of defaults) {
    await createCategory(cat.fr, cat.ar, cat.color)
  }
}

// Fonction pour nettoyer les doublons existants dans la base
async function cleanDuplicateCategories(): Promise<void> {
  try {
    // Récupérer tous les IDs avec leur nom
    const rows = await dbSelect<{ id: string; name_fr: string }>(
      `SELECT id, name_fr FROM categories ORDER BY name_fr`
    )

    const seen = new Map<string, string>()
    const toDelete: string[] = []

    for (const row of rows) {
      if (seen.has(row.name_fr)) {
        // Garder le premier ID, supprimer les suivants
        toDelete.push(row.id)
      } else {
        seen.set(row.name_fr, row.id)
      }
    }

    for (const id of toDelete) {
      // Vérifier qu'aucun produit n'utilise cette catégorie avant de supprimer
      const products = await dbSelect<{ id: string }>(
        `SELECT id FROM products WHERE category_id = ?`,
        [id]
      )
      if (products.length === 0) {
        await dbExecute(`DELETE FROM categories WHERE id = ?`, [id])
      }
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des catégories:', error)
  }
}