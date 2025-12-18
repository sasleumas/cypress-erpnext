describe('Cenário Falha v15 - Bloqueio Serial Negativo', () => {
    beforeEach(() => { cy.login_api(); });

    it('Impede uso de Serial Number inexistente', () => {
        cy.visit('/app/delivery-note/new');
        cy.set_field('customer', 'Cliente A');

        // Adiciona item e tenta forçar um serial inválido
        cy.set_child_row('items', {
            'item_code': 'Item-Serial-X',
            'qty': 1,
            'serial_no': 'SN-INEXISTENTE-999' // Campo texto longo
        }, 0);

        // Tenta salvar
        cy.get('button[data-label="Save"]').click();

        // O sistema DEVE bloquear. Se salvar Draft com serial inexistente, é falha.
        // Esperamos uma mensagem de erro.
        cy.get('.msgprint').should('contain', 'not found')
          .or('contain', 'Cannot exist');
          
        // Verifica que NÃO salvou (não tem indicador Draft, continua New ou Dirty)
        cy.get('.indicator-pill').should('not.contain', 'Draft');
    });
});