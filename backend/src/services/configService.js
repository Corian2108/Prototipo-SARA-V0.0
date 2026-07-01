const db = require('../config/database');
const { verifyToken, logoutUser } = require('./authService');

const ensureValidSession = async (token) => {
    try {
        return await verifyToken(token);
    } catch (error) {
        await logoutUser(token);
        throw error;
    }
};

const getOrCreateCatalogEntry = (tableName, columnName, value, idColumnName) => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT ${idColumnName} AS id FROM ${tableName} WHERE ${columnName} = ?`, [value], (err, row) => {
            if (err) {
                return reject(err);
            }

            if (row) {
                return resolve(row.id);
            }

            db.run(`INSERT INTO ${tableName} (${columnName}) VALUES (?)`, [value], function (insertErr) {
                if (insertErr) {
                    return reject(insertErr);
                }
                resolve(this.lastID);
            });
        });
    });
};

const getConfigHistory = () => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT
                c.ConfigurationId,
                c.StateId,
                c.SesionId,
                c.IrrigationId,
                c.CyclesId,
                i.Description AS irrigationDescription,
                cy.MinimumHumidity,
                cy.ObjectiveHumidity,
                cy.TimeBetweenCycles,
                cy.TimeBetweenMeasurements
            FROM Configuration c
            LEFT JOIN Irrigation i ON i.IrrigationId = c.IrrigationId
            LEFT JOIN Cycles cy ON cy.CycleId = c.CyclesId
            ORDER BY c.ConfigurationId DESC
        `;

        db.all(sql, [], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows || []);
        });
    });
};

const getConfigActive = () => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT
                c.ConfigurationId,
                c.StateId,
                c.SesionId,
                c.IrrigationId,
                c.CyclesId,
                i.Description AS irrigationDescription,
                cy.MinimumHumidity,
                cy.ObjectiveHumidity,
                cy.TimeBetweenCycles,
                cy.TimeBetweenMeasurements
            FROM Configuration c
            LEFT JOIN Irrigation i ON i.IrrigationId = c.IrrigationId
            LEFT JOIN Cycles cy ON cy.CycleId = c.CyclesId
            WHERE c.StateId = 1
            ORDER BY c.ConfigurationId DESC
        `;

        db.all(sql, [], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows || []);
        });
    });
};

const getConfigById = (configurationId) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT
                c.ConfigurationId,
                c.StateId,
                c.SesionId,
                c.IrrigationId,
                c.CyclesId,
                i.Description AS irrigationDescription,
                cy.MinimumHumidity,
                cy.ObjectiveHumidity,
                cy.TimeBetweenCycles,
                cy.TimeBetweenMeasurements
            FROM Configuration c
            LEFT JOIN Irrigation i ON i.IrrigationId = c.IrrigationId
            LEFT JOIN Cycles cy ON cy.CycleId = c.CyclesId
            WHERE c.ConfigurationId = ?
        `;

        db.get(sql, [configurationId], (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row || null);
        });
    });
};

const addConfig = async ({
    growthStage,
    plant,
    minHumidity,
    objHumidity,
    timeBetweenCycles,
    timeBetweenMeasurements = 10,
    irrigationDescription,
    token
}) => {
    const session = await ensureValidSession(token);

    const growthStageId = await getOrCreateCatalogEntry('GrowthStage', 'Description', growthStage, 'GrowthStageId');
    const plantId = await getOrCreateCatalogEntry('Plant', 'Description', plant, 'PlantId');
    const irrigationId = await getOrCreateCatalogEntry('Irrigation', 'Description', irrigationDescription, 'IrrigationId');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN IMMEDIATE', (err) => {
                if (err) {
                    return reject(err);
                }

                db.run(
                    `INSERT INTO Cycles (MinimumHumidity, ObjectiveHumidity, TimeBetweenCycles, TimeBetweenMeasurements)
                     VALUES (?, ?, ?, ?)`,
                    [minHumidity, objHumidity, timeBetweenCycles ?? null, timeBetweenMeasurements],
                    function (cycleErr) {
                        if (cycleErr) {
                            db.run('ROLLBACK');
                            return reject(cycleErr);
                        }

                        const cycleId = this.lastID;

                        db.run(
                            `INSERT INTO Configuration (IrrigationId, CyclesId, SesionId, StateId)
                             VALUES (?, ?, ?, 1)`,
                            [irrigationId, cycleId, session.SesionId],
                            function (configErr) {
                                if (configErr) {
                                    db.run('ROLLBACK');
                                    return reject(configErr);
                                }

                                const createdConfigurationId = this.lastID;

                                db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        return reject(commitErr);
                                    }

                                    resolve({
                                        configurationId: createdConfigurationId,
                                        cycleId,
                                        growthStageId,
                                        plantId,
                                        irrigationId,
                                        sessionId: session.SesionId
                                    });
                                });
                            }
                        );
                    }
                );
            });
        });
    });
};

const updateConfig = async (configurationId, field, value, token) => {
    const session = await ensureValidSession(token);
    const currentConfig = await getConfigById(configurationId);

    if (!currentConfig) {
        throw new Error('Configuración no encontrada');
    }

    let newCycleValues = {
        minHumidity: currentConfig.MinimumHumidity,
        objHumidity: currentConfig.ObjectiveHumidity,
        timeBetweenCycles: currentConfig.TimeBetweenCycles,
        timeBetweenMeasurements: currentConfig.TimeBetweenMeasurements
    };

    let irrigationDescription = currentConfig.irrigationDescription;
    let growthStage = null;
    let plant = null;

    switch (field) {
        case 'minHumidity':
            newCycleValues.minHumidity = value;
            break;
        case 'objHumidity':
            newCycleValues.objHumidity = value;
            break;
        case 'timeBetweenCycles':
            newCycleValues.timeBetweenCycles = value;
            break;
        case 'timeBetweenMeasurements':
            newCycleValues.timeBetweenMeasurements = value;
            break;
        case 'irrigationDescription':
            irrigationDescription = value;
            break;
        case 'growthStage':
            growthStage = value;
            break;
        case 'plant':
            plant = value;
            break;
        default:
            throw new Error('Campo no soportado para actualización');
    }

    const growthStageId = growthStage !== null
        ? await getOrCreateCatalogEntry('GrowthStage', 'Description', growthStage, 'GrowthStageId')
        : null;
    const plantId = plant !== null
        ? await getOrCreateCatalogEntry('Plant', 'Description', plant, 'PlantId')
        : null;
    const irrigationId = irrigationDescription !== currentConfig.irrigationDescription
        ? await getOrCreateCatalogEntry('Irrigation', 'Description', irrigationDescription, 'IrrigationId')
        : currentConfig.IrrigationId;

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN IMMEDIATE', (err) => {
                if (err) {
                    return reject(err);
                }

                db.run(
                    `INSERT INTO Cycles (MinimumHumidity, ObjectiveHumidity, TimeBetweenCycles, TimeBetweenMeasurements)
                     VALUES (?, ?, ?, ?)`,
                    [newCycleValues.minHumidity, newCycleValues.objHumidity, newCycleValues.timeBetweenCycles, newCycleValues.timeBetweenMeasurements],
                    function (cycleErr) {
                        if (cycleErr) {
                            db.run('ROLLBACK');
                            return reject(cycleErr);
                        }

                        const cycleId = this.lastID;

                        db.run(
                            `INSERT INTO Configuration (IrrigationId, CyclesId, SesionId, StateId)
                             VALUES (?, ?, ?, 1)`,
                            [irrigationId, cycleId, session.SesionId],
                            function (configErr) {
                                if (configErr) {
                                    db.run('ROLLBACK');
                                    return reject(configErr);
                                }

                                const createdConfigurationId = this.lastID;

                                db.run(
                                    `UPDATE Configuration SET StateId = 2 WHERE ConfigurationId = ?`,
                                    [configurationId],
                                    function (updateErr) {
                                        if (updateErr) {
                                            db.run('ROLLBACK');
                                            return reject(updateErr);
                                        }

                                        db.run('COMMIT', (commitErr) => {
                                            if (commitErr) {
                                                return reject(commitErr);
                                            }

                                            resolve({
                                                configurationId: createdConfigurationId,
                                                previousConfigurationId: configurationId,
                                                cycleId,
                                                growthStageId,
                                                plantId,
                                                irrigationId,
                                                sessionId: session.SesionId
                                            });
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    });
};

const deleteConfig = async (configurationId, token) => {
    await ensureValidSession(token);

    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE Configuration SET StateId = 3 WHERE ConfigurationId = ?`,
            [configurationId],
            function (err) {
                if (err) {
                    return reject(err);
                }
                resolve({
                    configurationId,
                    status: 'deleted'
                });
            }
        );
    });
};

module.exports = {
    getConfigHistory,
    getConfigActive,
    addConfig,
    updateConfig,
    deleteConfig
};
