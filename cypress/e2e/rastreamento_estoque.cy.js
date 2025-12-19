describe('RF007 - Rastreamento de Estoque', () => {
    const warehouseA = 'Lojas - DVV';
    const warehouseB = 'Produtos Acabados - DVV';

    beforeEach(() => { cy.login_api(); });

    it('CT007-01: Consulta de disponibilidade por localização', () => {
        const itemCode = `ITEM-BAL-${Date.now()}`;
        
        // Cria item e adiciona no estoque via API
        cy.create_doc('Item', {
            item_code: itemCode,
            item_group: 'Produtos',
            stock_uom: 'Unidade',
            is_stock_item: 1
        });

        // Adiciona 50 unidades no Armazém A via Entrada de Estoque
        cy.create_doc('Stock Entry', {
            stock_entry_type: 'Material Receipt',
            items: [{
                item_code: itemCode,
                qty: 50,
                t_warehouse: warehouseA
            }],
            docstatus: 1 // Submete automaticamente
        });

        // Consultar o Relatório "Stock Balance"
        // Filtros direto na URL para simular a consulta do usuário
        cy.visit(`http://localhost:8080/app/query-report/Stock Balance?item_code=${itemCode}&warehouse=${warehouseA}`);

        // Verifica se a linha aparece no relatório
        // Espera a grid carregar e busca a célula com o valor '50'
        cy.get('.page-form').should('contain', itemCode);
        cy.get('.page-form').should('contain', '50');
        cy.screenshot('CT007-01-consulta-disponibilida-localizacao');
    });

    it('CT007-02: Transferência e atualização de saldo por localização', () => {
        const itemCode = `ITEM-TRANSF-${Date.now()}`;

        // Cria item com 100 unidades na Origem
        cy.create_doc('Item', { item_code: itemCode, item_group: 'Produtos', is_stock_item: 1 });
        cy.create_doc('Stock Entry', {
            stock_entry_type: 'Material Receipt',
            items: [{ item_code: itemCode, qty: 100, t_warehouse: warehouseA }],
            docstatus: 1
        });

        // Realiza lançamento no estoque para transferência
        cy.visit('http://localhost:8080/app/stock-entry/new');
        
        cy.set_field('stock_entry_type', 'Material Transfer');
        
        // Adiciona item na grid
        cy.set_child_row('items', {
            'item_code': itemCode,
            'qty': 20,
            's_warehouse': warehouseA, // Origem
            't_warehouse': warehouseB  // Destino
        }, 0);

        cy.save_doc();
        cy.submit_doc();

        // Confere saldo nos dois armazéns
        cy.window().then(async (win) => {
            // Saldo Origem (Deve ser 80)
            const binSource = await win.frappe.db.get_value('Bin', 
                { item_code: itemCode, warehouse: warehouseA }, 'actual_qty');
            
            // Saldo Destino (Deve ser 20)
            const binTarget = await win.frappe.db.get_value('Bin', 
                { item_code: itemCode, warehouse: warehouseB }, 'actual_qty');

            expect(binSource.message.actual_qty).to.eq(80);
            expect(binTarget.message.actual_qty).to.eq(20);
        });
        cy.screenshot('CT007-02-transferencia-atualizacao-saldo');
    });

    it('CT007-03: Mensagem para SKU inexistente', () => {
        // Injeta o filtro direto na URL para garantir que o teste rode rápido
        const skuInvalido = 'SKU-FANTASMA-999';
        cy.visit(`http://localhost:8080/app/query-report/Stock Balance?item_code=${skuInvalido}`);

        // Espera o relatório tentar carregar
        //cy.get('.primary-action').should('contain', 'Gerar Novo'); 
        
        //Grid vazia
        cy.get('.dt-row').should('not.exist');

        // Verifica a mensagem de "Nada a exibir"
        cy.get('.no-result .msg').should('be.visible');
        
        cy.screenshot('CT007-03-sku-inexistente'); 
    });
});