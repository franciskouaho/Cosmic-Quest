import QuestionBank from '#models/question_bank'

class QuestionService {
  /**
   * Récupère une question aléatoire par thème
   */
  async getRandomQuestionByTheme(theme: string): Promise<QuestionBank | null> {
    try {
      // Obtenir une question aléatoire du thème spécifié qui est active
      const query = QuestionBank.query()
        .where('theme', theme)
        .where('is_active', true)
        .orderByRaw('RANDOM()')
        .limit(1)

      const question = await query.first()

      // Si aucune question n'est trouvée pour ce thème, essayez le thème standard
      if (!question && theme !== 'standard') {
        return this.getRandomQuestionByTheme('standard')
      }

      // Si on a trouvé une question, incrémenter son compteur d'utilisation
      if (question) {
        question.usageCount += 1
        await question.save()
      }

      return question
    } catch (error) {
      console.error("Erreur lors de la récupération d'une question aléatoire:", error)
      return null
    }
  }

  /**
   * Formatte une question en remplaçant les placeholders
   */
  formatQuestion(questionText: string, playerName: string): string {
    return questionText.replace('{playerName}', playerName)
  }
}

export default new QuestionService()
