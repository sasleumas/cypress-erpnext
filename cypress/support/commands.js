// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

Cypress.Commands.add('login', (email = 'admin.test@erpnext.com', password = 'user.admin') => {
  // Limpa cookies e localStorage para garantir um estado limpo
  cy.clearCookies();
  cy.clearLocalStorage();

  cy.session([email, password], () => {
    cy.visit('http://localhost:8080/login');
    
    // Localiza os campos de login do ERPNext
    // Seletores genéricos que o Frappe utiliza na tela de login
    cy.get('#login_email').type(email);
    cy.get('#login_password').type(password, { log: false });
    
    cy.get('.btn-login').click();

    // Garante que o dashboard carregou antes de prosseguir
    cy.url().should('include', '/app');
    cy.get('.navbar').should('be.visible');
  });
});

//Login Rápido via API (Sem passar pela tela de login)
Cypress.Commands.add('login_api', (user = 'admin.test@erpnext.com', pwd = 'user.admin') => {
    cy.session([user, pwd], () => {
        cy.request({
            method: 'POST',
            url: 'http://localhost:8080/api/method/login',
            body: { usr: user, pwd: pwd },
            failOnStatusCode: false
        }).then((resp) => {
            if (resp.status !== 200 && resp.body.message !== 'Logged In') {
                throw new Error('Falha no Login API');
            }
        });
    });
});

// Preenche campo do formulário principal
Cypress.Commands.add('set_field', (fieldname, value) => {
    cy.window().then(async (win) => {
        const frm = win.cur_frm;
        if (!frm) throw new Error('Formulário não carregado.');
        
        // set_value dispara os gatilhos de mudança (on_change)
        await frm.set_value(fieldname, value);
    });
});

// Adiciona ou edita linha em tabela filha (com gatilhos)
Cypress.Commands.add('set_child_row', (tableField, rowFields, rowIndex = 0, forceAdd = false) => {
    cy.window().then(async (win) => {
        const frm = win.cur_frm;
        let row;

        // Decide se edita linha existente ou cria nova
        if (!forceAdd && frm.doc[tableField] && frm.doc[tableField].length > rowIndex) {
            row = frm.doc[tableField][rowIndex];
        } else {
            row = frm.add_child(tableField);
        }

        // Itera sobre os campos para preencher (ex: {item_code: 'X', qty: 10})
        for (const [key, value] of Object.entries(rowFields)) {
            // frappe.model.set_value é vital para buscar UDM, Preço, etc.
            await win.frappe.model.set_value(row.doctype, row.name, key, value);
            // Pequena pausa interna para scripts do ERPNext rodarem
            await new Promise(r => setTimeout(r, 200)); 
        }

        frm.refresh_field(tableField);
    });
    cy.wait(500); // Espera a grid renderizar
});

// Ignora Modais de Confirmação (Simular clique em "Yes")
Cypress.Commands.add('bypass_confirm', () => {
    cy.window().then((win) => {
        win.frappe.confirm = (msg, yes) => { 
            console.log('Cypress: Modal de confirmação auto-aceito: ' + msg);
            if(yes) yes(); 
        };
    });
});

// Salvar e Submeter
Cypress.Commands.add('save_doc', () => {
    cy.get('button[data-label="Salvar"]').click();
    cy.get('button[data-label="Salvar"]').should('not.exist'); // Espera o botão mudar estado
    cy.wait(1000);
});

Cypress.Commands.add('submit_doc', () => {
    cy.bypass_confirm();
    cy.get('button[data-label="Enviar"]').should('be.visible').click();
    cy.wait(1000);
});

// Cancelar via Código
Cypress.Commands.add('cancel_doc', () => {
    cy.window().then((win) => {
        // O método de cancelamento exige passar pelo fluxo de workflow às vezes
        return win.cur_frm.save('Cancel');
    });
    // O ERPNext quase sempre pede confirmação "Tem certeza que deseja cancelar?"
    // Usa o bypass para dizer "Sim" automaticamente
    cy.bypass_confirm();
    cy.wait(1000);
});

// Simula a criação de um documento a partir de outro
Cypress.Commands.add('create_mapped_doc', (method, source_name) => {
    cy.window().then((win) => {
        return win.frappe.model.open_mapped_doc({
            method: method,
            source_name: source_name
        });
    });
    // Espera a nova tela carregar
    cy.get('.title-text').should('contain', 'Novo'); 
});

// Comando para criar qualquer documento via API REST
Cypress.Commands.add('create_doc', (doctype, data) => {
    
    return cy.request({
        method: 'POST',
        url: `http://localhost:8080/api/resource/${doctype}`,
        body: data,
        failOnStatusCode: false // Para podermos tratar erros manualmente se precisar
    }).then((response) => {
        if (response.status !== 200) {
            // Tenta extrair a mensagem de erro legível do Frappe
            let errorMsg = 'Erro desconhecido';
            
            if (response.body.exception) errorMsg = response.body.exception;
            if (response.body._server_messages) {
                try {
                    const messages = JSON.parse(response.body._server_messages);
                    errorMsg = JSON.parse(messages[0]).message;
                } catch (e) {}
            }

            // Imprime o erro no console do Cypress para você ler
            cy.log(`ERRO API (${doctype}): ${errorMsg}`);
            console.error('Detalhes do Erro API:', response.body);
            
            throw new Error(`Falha ao criar ${doctype}: ${errorMsg}`);
        }
        // Retorna o corpo da resposta (contém o 'data' com o nome do doc criado)
        return response.body.data;
    });
});