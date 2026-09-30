"use strict";

module.exports = {
    async up(queryInterface) {
        const tableName = "users";
        const constraintName = "users_email_or_phone_required";

        // --------------------------------------------------
        // Helpers
        // --------------------------------------------------

        const getColumns = async () => {
            return queryInterface.describeTable(tableName);
        };

        const constraintExists = async () => {
            const [rows] = await queryInterface.sequelize.query(
                `
                SELECT CONSTRAINT_NAME
                FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = :tableName
                  AND CONSTRAINT_NAME = :constraintName
                  AND CONSTRAINT_TYPE = 'CHECK'
                `,
                {
                    replacements: {
                        tableName,
                        constraintName
                    }
                }
            );

            return rows.length > 0;
        };

        const renameColumnIfNeeded = async (oldName, newName) => {
            const columns = await getColumns();

            const oldExists =
                Object.prototype.hasOwnProperty.call(columns, oldName);

            const newExists =
                Object.prototype.hasOwnProperty.call(columns, newName);

            // Normal starting state
            if (oldExists && !newExists) {
                await queryInterface.renameColumn(
                    tableName,
                    oldName,
                    newName
                );

                return;
            }

            // Already renamed by a previous partial run
            if (!oldExists && newExists) {
                return;
            }

            // Dangerous / ambiguous state
            if (oldExists && newExists) {
                throw new Error(
                    `Migration stopped: both "${oldName}" and "${newName}" exist. Manual investigation required.`
                );
            }

            throw new Error(
                `Migration stopped: neither "${oldName}" nor "${newName}" exists. Unexpected schema state.`
            );
        };

        // --------------------------------------------------
        // 1. Remove old CHECK constraint if it still exists
        // --------------------------------------------------

        if (await constraintExists()) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                DROP CHECK \`users_email_or_phone_required\`
            `);
        }

        // --------------------------------------------------
        // 2. Rename ordinary columns
        // --------------------------------------------------

        await renameColumnIfNeeded(
            "phoneNumber",
            "phone_number"
        );

        await renameColumnIfNeeded(
            "passwordHash",
            "password_hash"
        );

        await renameColumnIfNeeded(
            "emailVerifiedAt",
            "email_verified_at"
        );

        await renameColumnIfNeeded(
            "phoneVerifiedAt",
            "phone_verified_at"
        );

        await renameColumnIfNeeded(
            "lastSeenAt",
            "last_seen_at"
        );

        // --------------------------------------------------
        // 3. Rename createdAt safely
        // --------------------------------------------------

        let columns = await getColumns();

        const createdAtExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "createdAt"
            );

        const createdAtSnakeExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "created_at"
            );

        if (createdAtExists && !createdAtSnakeExists) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                CHANGE COLUMN \`createdAt\` \`created_at\`
                DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP
            `);
        } else if (createdAtExists && createdAtSnakeExists) {
            throw new Error(
                'Migration stopped: both "createdAt" and "created_at" exist.'
            );
        } else if (!createdAtExists && !createdAtSnakeExists) {
            throw new Error(
                'Migration stopped: neither "createdAt" nor "created_at" exists.'
            );
        }

        // --------------------------------------------------
        // 4. Rename updatedAt safely
        // --------------------------------------------------

        columns = await getColumns();

        const updatedAtExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "updatedAt"
            );

        const updatedAtSnakeExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "updated_at"
            );

        if (updatedAtExists && !updatedAtSnakeExists) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                CHANGE COLUMN \`updatedAt\` \`updated_at\`
                DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
            `);
        } else if (updatedAtExists && updatedAtSnakeExists) {
            throw new Error(
                'Migration stopped: both "updatedAt" and "updated_at" exist.'
            );
        } else if (!updatedAtExists && !updatedAtSnakeExists) {
            throw new Error(
                'Migration stopped: neither "updatedAt" nor "updated_at" exists.'
            );
        }

        // --------------------------------------------------
        // 5. Rename deletedAt
        // --------------------------------------------------

        await renameColumnIfNeeded(
            "deletedAt",
            "deleted_at"
        );

        // --------------------------------------------------
        // 6. Recreate CHECK constraint if missing
        // --------------------------------------------------

        if (!(await constraintExists())) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                ADD CONSTRAINT \`users_email_or_phone_required\`
                CHECK (
                    \`email\` IS NOT NULL
                    OR
                    \`phone_number\` IS NOT NULL
                )
            `);
        }

        // --------------------------------------------------
        // 7. Final assertion of updated_at behavior
        // --------------------------------------------------

        await queryInterface.sequelize.query(`
            ALTER TABLE \`users\`
            MODIFY COLUMN \`updated_at\`
            DATETIME NOT NULL
            DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP
        `);
    },

    async down(queryInterface) {
        const tableName = "users";
        const constraintName = "users_email_or_phone_required";

        const getColumns = async () => {
            return queryInterface.describeTable(tableName);
        };

        const constraintExists = async () => {
            const [rows] = await queryInterface.sequelize.query(
                `
                SELECT CONSTRAINT_NAME
                FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = :tableName
                  AND CONSTRAINT_NAME = :constraintName
                  AND CONSTRAINT_TYPE = 'CHECK'
                `,
                {
                    replacements: {
                        tableName,
                        constraintName
                    }
                }
            );

            return rows.length > 0;
        };

        const renameColumnIfNeeded = async (oldName, newName) => {
            const columns = await getColumns();

            const oldExists =
                Object.prototype.hasOwnProperty.call(
                    columns,
                    oldName
                );

            const newExists =
                Object.prototype.hasOwnProperty.call(
                    columns,
                    newName
                );

            if (oldExists && !newExists) {
                await queryInterface.renameColumn(
                    tableName,
                    oldName,
                    newName
                );

                return;
            }

            if (!oldExists && newExists) {
                return;
            }

            if (oldExists && newExists) {
                throw new Error(
                    `Rollback stopped: both "${oldName}" and "${newName}" exist.`
                );
            }

            throw new Error(
                `Rollback stopped: neither "${oldName}" nor "${newName}" exists.`
            );
        };

        // --------------------------------------------------
        // 1. Remove snake_case CHECK constraint
        // --------------------------------------------------

        if (await constraintExists()) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                DROP CHECK \`users_email_or_phone_required\`
            `);
        }

        // --------------------------------------------------
        // 2. Reverse ordinary columns
        // --------------------------------------------------

        await renameColumnIfNeeded(
            "phone_number",
            "phoneNumber"
        );

        await renameColumnIfNeeded(
            "password_hash",
            "passwordHash"
        );

        await renameColumnIfNeeded(
            "email_verified_at",
            "emailVerifiedAt"
        );

        await renameColumnIfNeeded(
            "phone_verified_at",
            "phoneVerifiedAt"
        );

        await renameColumnIfNeeded(
            "last_seen_at",
            "lastSeenAt"
        );

        // --------------------------------------------------
        // 3. Reverse created_at
        // --------------------------------------------------

        let columns = await getColumns();

        const createdSnakeExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "created_at"
            );

        const createdCamelExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "createdAt"
            );

        if (createdSnakeExists && !createdCamelExists) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                CHANGE COLUMN \`created_at\` \`createdAt\`
                DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP
            `);
        } else if (createdSnakeExists && createdCamelExists) {
            throw new Error(
                'Rollback stopped: both "created_at" and "createdAt" exist.'
            );
        } else if (!createdSnakeExists && !createdCamelExists) {
            throw new Error(
                'Rollback stopped: neither "created_at" nor "createdAt" exists.'
            );
        }

        // --------------------------------------------------
        // 4. Reverse updated_at
        // --------------------------------------------------

        columns = await getColumns();

        const updatedSnakeExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "updated_at"
            );

        const updatedCamelExists =
            Object.prototype.hasOwnProperty.call(
                columns,
                "updatedAt"
            );

        if (updatedSnakeExists && !updatedCamelExists) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                CHANGE COLUMN \`updated_at\` \`updatedAt\`
                DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
            `);
        } else if (updatedSnakeExists && updatedCamelExists) {
            throw new Error(
                'Rollback stopped: both "updated_at" and "updatedAt" exist.'
            );
        } else if (!updatedSnakeExists && !updatedCamelExists) {
            throw new Error(
                'Rollback stopped: neither "updated_at" nor "updatedAt" exists.'
            );
        }

        // --------------------------------------------------
        // 5. Reverse deleted_at
        // --------------------------------------------------

        await renameColumnIfNeeded(
            "deleted_at",
            "deletedAt"
        );

        // --------------------------------------------------
        // 6. Restore original CHECK constraint
        // --------------------------------------------------

        if (!(await constraintExists())) {
            await queryInterface.sequelize.query(`
                ALTER TABLE \`users\`
                ADD CONSTRAINT \`users_email_or_phone_required\`
                CHECK (
                    \`email\` IS NOT NULL
                    OR
                    \`phoneNumber\` IS NOT NULL
                )
            `);
        }
    }
};