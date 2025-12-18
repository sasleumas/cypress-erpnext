describe('Cenário Falha v15 - Depreciação Ativo Existente', () => {
    beforeEach(() => { cy.login_api(); });

    it('Valida cálculo de cronograma para ativo legado', () => {
        cy.visit('/app/asset/new');
        
        cy.set_field('item_code', 'Laptop-Asset');
        cy.set_field('asset_name', 'Laptop Teste Falha');
        cy.set_field('is_existing_asset', 1); // Checkbox = 1
        
        // Datas retroativas
        cy.set_field('purchase_date', '2024-01-01');
        cy.set_field('available_for_use_date', '2024-01-01');
        cy.set_field('gross_purchase_amount', 5000);
        
        // Campos de abertura
        cy.set_field('opening_accumulated_depreciation', 1000);
        cy.set_field('number_of_depreciations_booked', 2);

        // Configura tabela de finanças
        cy.set_child_row('finance_books', {
            'depreciation_method': 'Straight Line',
            'total_number_of_depreciations': 10,
            'frequency_of_depreciation': 12
        }, 0);

        // Ao salvar, o cálculo acontece
        cy.save_doc();

        // VALIDAÇÃO DO BUG:
        // Se o bug existir, o número de agendamentos gerados será errado.
        // Esperado: 10 total - 2 já feitos = 8 agendamentos futuros.
        cy.window().then((win) => {
            const schedules = win.cur_frm.doc.schedules || [];
            // Se vier 10, o sistema ignorou os 2 já feitos (Bug comum na v15)
            expect(schedules.length).to.eq(8); 
        });
    });
});