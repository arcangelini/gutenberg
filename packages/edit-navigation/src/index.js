/**
 * External dependencies
 */
import { map, set, flatten, omit, partialRight } from 'lodash';

/**
 * WordPress dependencies
 */
import '@wordpress/notices';
import {
	registerCoreBlocks,
	__experimentalRegisterExperimentalCoreBlocks,
} from '@wordpress/block-library';
import { render } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { decodeEntities } from '@wordpress/html-entities';
import { addFilter, removeFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import Layout from './components/layout';
import './store';

function disableInsertingNonNavigationBlocks( settings, name ) {
	if ( ! [ 'core/navigation', 'core/navigation-link' ].includes( name ) ) {
		set( settings, [ 'supports', 'inserter' ], false );
	}
	return settings;
}

function removeColorSupportFromNavigationBlock( settings, name ) {
	if ( name !== 'core/navigation' ) {
		return settings;
	}

	return {
		...settings,
		supports: omit( settings.supports, '__experimentalColor' ),
	};
}

/**
 * Fetches link suggestions from the API. This function is an exact copy of a function found at:
 *
 * packages/editor/src/components/provider/index.js
 *
 * It seems like there is no suitable package to import this from. Ideally it would be either part of core-data.
 * Until we refactor it, just copying the code is the simplest solution.
 *
 * @param {string} search
 * @param {Object} [searchArguments]
 * @param {number} [searchArguments.isInitialSuggestions]
 * @param {number} [searchArguments.type]
 * @param {number} [searchArguments.subtype]
 * @param {Object} [editorSettings]
 * @param {boolean} [editorSettings.disablePostFormats=false]
 * @return {Promise<Object[]>} List of suggestions
 */
const fetchLinkSuggestions = (
	search,
	{ isInitialSuggestions, type, subtype } = {},
	{ disablePostFormats = false } = {}
) => {
	const perPage = isInitialSuggestions ? 3 : 20;

	const queries = [];

	if ( ! type || type === 'post' ) {
		queries.push(
			apiFetch( {
				path: addQueryArgs( '/wp/v2/search', {
					search,
					per_page: perPage,
					type: 'post',
					subtype,
				} ),
			} )
		);
	}

	if ( ! type || type === 'term' ) {
		queries.push(
			apiFetch( {
				path: addQueryArgs( '/wp/v2/search', {
					search,
					per_page: perPage,
					type: 'term',
					subtype,
				} ),
			} )
		);
	}

	if ( ! disablePostFormats && ( ! type || type === 'post-format' ) ) {
		queries.push(
			apiFetch( {
				path: addQueryArgs( '/wp/v2/search', {
					search,
					per_page: perPage,
					type: 'post-format',
					subtype,
				} ),
			} )
		);
	}

	return Promise.all( queries ).then( ( results ) => {
		return map( flatten( results ).slice( 0, perPage ), ( result ) => ( {
			id: result.id,
			url: result.url,
			title: decodeEntities( result.title ) || __( '(no title)' ),
			type: result.subtype || result.type,
		} ) );
	} );
};

// Remove support for various features from the navigation block.
removeFilter(
	'editor.BlockEdit',
	'core/block-library/navigation/with-inspector-controls'
);

removeFilter(
	'editor.BlockEdit',
	'core/block-library/navigation/with-block-controls'
);

removeFilter(
	'editor.BlockEdit',
	'core/block-library/navigation/with-list-view'
);

export function initialize( id, settings ) {
	if ( ! settings.blockNavMenus ) {
		addFilter(
			'blocks.registerBlockType',
			'core/edit-navigation/disable-inserting-non-navigation-blocks',
			disableInsertingNonNavigationBlocks
		);
	}

	addFilter(
		'blocks.registerBlockType',
		'core/edit-navigation',
		removeColorSupportFromNavigationBlock
	);

	registerCoreBlocks();

	if ( process.env.GUTENBERG_PHASE === 2 ) {
		__experimentalRegisterExperimentalCoreBlocks( settings );
	}

	settings.__experimentalFetchLinkSuggestions = partialRight(
		fetchLinkSuggestions,
		settings
	);

	render(
		<Layout blockEditorSettings={ settings } />,
		document.getElementById( id )
	);
}
