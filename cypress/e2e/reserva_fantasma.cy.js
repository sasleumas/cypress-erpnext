describe('Cenário Falha v15 - Reserva Fantasma', () => {
    beforeEach(() => { cy.login_api(); });

    it('Verifica se reserva é limpa após cancelar pedido', () => {
        const itemTeste = 'Produto-Reserva';
        
        // 1. Criar Pedido
        cy.visit('/app/sales-order/new');
        cy.set_field('customer', 'Cliente A');
        cy.set_field('delivery_date', '2025-12-31');
        cy.set_child_row('items', { 'item_code': itemTeste, 'qty': 10 }, 0);
        cy.save_doc();
        cy.submit_doc();

        // 2. Cancelar Pedido (Via API de clique para garantir fluxo de UI)
        cy.get('button[data-label="Cancel"]').click();
        cy.bypass_confirm(); // Aceita "Deseja cancelar?"
        cy.get('button[data-label="Yes"]').click(); // Confirmação extra de cancelamento se houver
        
        cy.get('.indicator-pill').should('contain', 'Cancelled');

        // 3. Verificar Bin (Tabela de Estoque) via API direta
        // Isso evita ter que abrir o relatório visualmente, o que é lento e propenso a erro
        cy.window().then((win) => {
            return win.frappe.db.get_value('Bin', { 'item_code': itemTeste }, 'reserved_qty');
        }).then((r) => {
            const reservedQty = r.message.reserved_qty || 0;
            // Se for > 0, o bug existe!
            expect(reservedQty).to.eq(0); 
        });
    });
});