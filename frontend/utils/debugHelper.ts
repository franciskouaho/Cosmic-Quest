/**
 * Utilitaire de vérification et débogage pour éviter des erreurs de référence
 */
export class DebugHelper {
  /**
   * Vérifie si une classe ou fonction est disponible dans le contexte global
   * @param name Nom de la classe ou fonction à vérifier
   * @returns boolean indiquant si l'objet est disponible
   */
  static isAvailable(name: string): boolean {
    try {
      // Vérifier si l'objet existe dans le scope global
      const exists = typeof global[name] !== 'undefined';
      
      if (!exists) {
        console.warn(`⚠️ Objet '${name}' non disponible dans le contexte global`);
      }
      
      return exists;
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de '${name}':`, error);
      return false;
    }
  }

  /**
   * Vérifie la présence d'une classe et fournit un fallback en cas d'absence
   * @param className Nom de la classe à vérifier
   * @param fallback Fonction fallback à utiliser si la classe n'existe pas
   * @returns La classe d'origine ou le fallback
   */
  static ensureClass(className: string, fallback: any): any {
    try {
      const ClassObj = global[className];
      if (typeof ClassObj !== 'undefined') {
        return ClassObj;
      }
      
      console.warn(`⚠️ Classe '${className}' non disponible, utilisation du fallback`);
      return fallback;
    } catch (error) {
      console.error(`❌ Erreur lors de la résolution de la classe '${className}':`, error);
      return fallback;
    }
  }
  
  /**
   * Enregistre la pile d'appels actuelle pour déboguer les erreurs d'importation
   */
  static logCallStack(message: string = "Débogage de la pile d'appels"): void {
    console.log(`🔍 ${message}`);
    try {
      throw new Error("Trace stack");
    } catch (e) {
      console.log(e.stack.split("\n").slice(2).join("\n"));
    }
  }
}

export default DebugHelper;
