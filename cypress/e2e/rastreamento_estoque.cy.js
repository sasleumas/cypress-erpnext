describe('RF007 - Rastreamento de Estoque', () => {
    beforeEach(() => { cy.login_api(); });

    it('CT007-03: Consulta por SKU inexistente', () => {
        // Injeta o filtro direto na URL para garantir que o teste rode rápido
        const skuInvalido = 'SKU-FANTASMA-999';
        cy.visit(`/app/query-report/Stock Balance?item_code=${skuInvalido}`);

        // Espera o relatório tentar carregar
        cy.get('.primary-action').should('contain', 'Refresh'); 
        
        // Verifica a mensagem de "Nada a exibir"
        // O seletor pode variar dependendo da versão, mas 'no-result' é padrão
        cy.get('.no-result .msg').should('be.visible').and('contain', 'Nothing to show');
    });
});