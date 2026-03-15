import * as BABYLON from '@babylonjs/core';
import { GAME_CONFIG, VISUAL_CONFIG } from '../../config';
import { GameAction, InputManager, getInputPrompt } from '../../engine/InputManager';
import { GameStateData, GameMessage, RemoteGameState } from '../../types/index';
import { System, ReviveEvent } from '../../types/systems';
import { EventBus } from '../../engine/EventBus';
import { TimerManager } from '../../engine/TimerManager';

export interface IReviveContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    eventBus: EventBus;
    timerManager: TimerManager;
    remote: {
        pos: BABYLON.Vector3;
        gameState: RemoteGameState;
    };
    send(data: GameMessage): void;
    addPoints(amount: number): void;
    hasDoublePoints(): boolean;
    setHealth(v: number): void;
    setIsDowned(v: boolean): void;
    setIsBeingRevived(v: boolean): void;
    setInteractionMsg(v: string | null): void;
    setHoverMsg(v: string | null): void;
    setPerks(v: Record<string, boolean>): void;
    restoreWeaponsAfterRevive(): void;
}

/**
 * ReviveSystem
 *
 * Handles teammate revive interactions in multiplayer (HOST or CLIENT mode).
 */
export const createReviveSystem = (
    ctx: IReviveContext,
    inputManager: InputManager,
): System => {

    const cancelRevive = () => {
        ctx.gameState.isRevivingTeammate = false;
        ctx.gameState.reviveProgress     = 0;
        ctx.send({ type: 'REVIVE_CANCEL', revivorName: ctx.gameState.playerName });
    };

    const handleReviveEvent = (data: ReviveEvent) => {
        const gameState = ctx.gameState;
        if (data.type === 'START') {
            if (gameState.isDowned) {
                gameState.isBeingRevived = true;
                ctx.setIsBeingRevived(true);
                ctx.setInteractionMsg(`BEING REVIVED BY ${data.revivorName}...`);
            }
        } else if (data.type === 'CANCEL') {
            if (gameState.isDowned) {
                gameState.isBeingRevived = false;
                ctx.setIsBeingRevived(false);
                ctx.setInteractionMsg(null);
            }
        } else if (data.type === 'COMPLETE') {
            if (gameState.isDowned) {
                gameState.isDowned          = false;
                gameState.health            = GAME_CONFIG.REVIVE_HEALTH;
                gameState.isBeingRevived    = false;
                gameState.perkStates        = {};
                ctx.restoreWeaponsAfterRevive();
                ctx.setPerks({});
                ctx.setHealth(GAME_CONFIG.REVIVE_HEALTH);
                ctx.setIsDowned(false);
                ctx.setIsBeingRevived(false);
                ctx.setInteractionMsg('REVIVED!');
                ctx.timerManager.schedule('revive_msg_clear', VISUAL_CONFIG.HUD_MSG_DURATION, () => ctx.setInteractionMsg(null));
                // Camera will lerp up smoothly via DownedSystem
            } else {
                ctx.remote.gameState.isDowned = false;
            }
        }
    };
    ctx.eventBus.on('REVIVE_EVENT', handleReviveEvent);

    return {
        name: 'revive',
        dispose: () => {
            ctx.eventBus.off('REVIVE_EVENT', handleReviveEvent);
        },
        update: (dt: number) => {
            const gameState = ctx.gameState;

            if (
                ctx.gameModeRef.current === 'SOLO' ||
                !gameState.hasStarted ||
                gameState.isDowned ||
                gameState.isSpectating ||
                gameState.isGameOver
            ) {
                if (gameState.isRevivingTeammate) cancelRevive();
                return;
            }

            const remotePos = ctx.remote.pos;
            const myPos     = ctx.camera.position;
            const dist      = BABYLON.Vector3.Distance(myPos, remotePos);

            if (ctx.remote.gameState.isDowned && dist < GAME_CONFIG.REVIVE_DISTANCE) {
                const prompt = getInputPrompt(GameAction.INTERACT, inputManager.getInputDevice());
                ctx.setHoverMsg(`HOLD [${prompt}] TO REVIVE TEAMMATE`);

                if (inputManager.isDown(GameAction.INTERACT)) {
                    if (!gameState.isRevivingTeammate) {
                        gameState.isRevivingTeammate = true;
                        ctx.send({
                            type:             'REVIVE_START',
                            revivorName:      gameState.playerName,
                            downedPlayerName: 'Teammate',
                        });
                    }

                    const hasQuickRevive = gameState.perkStates['quickRevive'];
                    const requiredTime   = hasQuickRevive ? GAME_CONFIG.REVIVE_QUICK_TIME : GAME_CONFIG.REVIVE_BASE_TIME;
                    gameState.reviveProgress += (dt * 1000) / requiredTime;

                    if (gameState.reviveProgress >= 1.0) {
                        ctx.addPoints(ctx.hasDoublePoints() ? GAME_CONFIG.REVIVE_REWARD * 2 : GAME_CONFIG.REVIVE_REWARD);
                        ctx.send({
                            type:             'REVIVE_COMPLETE',
                            revivorName:      gameState.playerName,
                            downedPlayerName: 'Teammate',
                        });
                        gameState.isRevivingTeammate = false;
                        gameState.reviveProgress     = 0;
                        ctx.setInteractionMsg('REVIVE SUCCESSFUL');
                        ctx.timerManager.schedule('revive_success_msg_clear', VISUAL_CONFIG.HUD_MSG_DURATION, () => ctx.setInteractionMsg(null));
                    }
                } else if (gameState.isRevivingTeammate) {
                    cancelRevive();
                }
            } else if (gameState.isRevivingTeammate) {
                cancelRevive();
            }
        },
    };
};
